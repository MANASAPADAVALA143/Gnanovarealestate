import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { toE164 } from '../../lib/phone-e164'
import { portalBranchingSystemPrompt, PRIYA_CAMPAIGN_FIRST_MESSAGE } from '../../lib/vapi-priya-branching-prompt'
import { extractZip, matchAgent } from './agent-matcher'
import { sendAgentSMSAlert } from './sms-alert'
import { onLeadCreated } from '../../lib/crm-hooks'

export interface NormalisedLead {
  name: string
  email: string
  phone: string
  message?: string
  location?: string
  property_address?: string
  specialty_tags?: string[]
  portal_source: 'zillow' | 'realtor'
  portal_lead_id: string
  raw_payload: Record<string, unknown>
}

function getPortalSupabase(): SupabaseClient {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) {
    throw new Error('Supabase URL or service role key is not configured for portal intake')
  }
  return createClient(url, key)
}

function appBaseUrlForSpeedWebhook(): string {
  return (
    process.env.SPEED_WEBHOOK_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'http://localhost:3002'
  ).replace(/\/$/, '')
}

async function resolveAgentIdForLead(supabase: SupabaseClient, lead: NormalisedLead): Promise<string | null> {
  const zip = extractZip(lead.location) || extractZip(lead.property_address)
  let resolvedAgentId: string | null = await matchAgent(supabase, {
    zip_code: zip,
    specialty_tags: lead.specialty_tags,
  })

  if (!resolvedAgentId) {
    const envId = process.env.PORTAL_DEFAULT_AGENT_ID?.trim()
    resolvedAgentId = envId || null
  }

  if (!resolvedAgentId) {
    const { data: firstAgent } = await supabase
      .from('agents')
      .select('id')
      .eq('is_available', true)
      .limit(1)
      .maybeSingle()
    resolvedAgentId = (firstAgent as { id?: string } | null)?.id ?? null
  }

  if (!resolvedAgentId) {
    const { data: anyAgent } = await supabase.from('agents').select('id').limit(1).maybeSingle()
    resolvedAgentId = (anyAgent as { id?: string } | null)?.id ?? null
  }

  return resolvedAgentId
}

async function triggerSpeedToLeadVapi(
  supabase: SupabaseClient,
  params: {
    speedLogId: string
    leadId: string
    name: string
    phone: string
    sourceLabel: string
    propertyLine: string
    locationLine: string
    portal: string
  }
): Promise<void> {
  const apiKey = process.env.VAPI_API_KEY || process.env.VITE_VAPI_API_KEY
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID || process.env.VITE_VAPI_PHONE_NUMBER_ID
  if (!apiKey || !phoneNumberId) {
    console.warn('[portal-intake] VAPI not configured; skipping outbound call')
    await supabase.from('speed_to_lead_log').update({ call_status: 'skipped_no_vapi' }).eq('id', params.speedLogId)
    return
  }

  const number = toE164(params.phone)
  if (!number || number.length < 8) {
    await supabase.from('speed_to_lead_log').update({ call_status: 'skipped_bad_phone' }).eq('id', params.speedLogId)
    throw new Error('Invalid phone for VAPI')
  }

  const firstMessage = PRIYA_CAMPAIGN_FIRST_MESSAGE

  const portalLabel = params.portal === 'zillow' ? 'Zillow' : 'Realtor.com'
  const systemContent = portalBranchingSystemPrompt({
    portalLabel,
    propertyLine: params.propertyLine,
    locationLine: params.locationLine,
  })

  const serverUrl = `${appBaseUrlForSpeedWebhook()}/api/vapi/speed-webhook`

  const response = await fetch('https://api.vapi.ai/call/phone', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      phoneNumberId,
      customer: {
        number,
        name: params.name,
      },
      assistant: {
        name: 'Priya',
        firstMessage,
        model: {
          provider: 'openai',
          model: 'gpt-4o',
          messages: [{ role: 'system', content: systemContent }],
        },
        voice: {
          provider: '11labs',
          voiceId: '21m00Tcm4TlvDq8ikWAM',
        },
        recordingEnabled: true,
        maxDurationSeconds: 240,
        serverUrl,
        metadata: {
          leadId: params.leadId,
          speedLogId: params.speedLogId,
          source: params.sourceLabel,
          type: 'speed_to_lead',
        },
      },
    }),
  })

  const triggeredAt = new Date().toISOString()

  if (!response.ok) {
    const errText = await response.text()
    console.error('[portal-intake] VAPI error:', errText)
    await supabase
      .from('speed_to_lead_log')
      .update({ call_status: 'failed', call_triggered_at: triggeredAt })
      .eq('id', params.speedLogId)
    throw new Error(`VAPI error: ${errText}`)
  }

  const data = (await response.json()) as { id?: string }
  if (!data.id) throw new Error('VAPI did not return call id')

  await supabase
    .from('speed_to_lead_log')
    .update({
      call_status: 'calling',
      vapi_call_id: data.id,
      call_triggered_at: triggeredAt,
    })
    .eq('id', params.speedLogId)
}

export async function handlePortalLead(lead: NormalisedLead): Promise<{ duplicate: boolean; lead_id: string }> {
  const supabase = getPortalSupabase()
  const receivedAt = new Date()

  const phone = toE164(lead.phone)
  if (!phone || phone.replace(/\D/g, '').length < 8) {
    await supabase.from('portal_events').insert({
      portal: lead.portal_source,
      raw_payload: lead.raw_payload as object,
      error: 'invalid_phone',
    } as never)
    throw new Error('Valid phone number is required')
  }

  const { data: existing } = await supabase
    .from('leads')
    .select('id')
    .eq('portal_source', lead.portal_source)
    .eq('portal_lead_id', lead.portal_lead_id)
    .maybeSingle()

  if (existing?.id) {
    await supabase.from('portal_events').insert({
      portal: lead.portal_source,
      raw_payload: lead.raw_payload as object,
      lead_id: existing.id,
      duplicate: true,
    } as never)
    return { duplicate: true, lead_id: existing.id }
  }

  const agentId = await resolveAgentIdForLead(supabase, lead)
  const now = new Date().toISOString()
  const sourceDisplay = lead.portal_source === 'zillow' ? 'Zillow' : 'Realtor.com'

  const { data: newLead, error } = await supabase
    .from('leads')
    .insert({
      name: lead.name.trim() || 'Unknown',
      email: lead.email?.trim() || null,
      phone,
      location: lead.location?.trim() || null,
      source: sourceDisplay,
      portal_source: lead.portal_source,
      portal_lead_id: lead.portal_lead_id,
      message: lead.message?.trim() || null,
      property_address: lead.property_address?.trim() || null,
      status: 'new',
      agent_id: agentId,
      updated_at: now,
    } as never)
    .select('id')
    .single()

  if (error || !newLead) {
    const msg = error?.message ?? 'Lead insert failed'
    if (error?.code === '23505') {
      const { data: byPhone } = await supabase.from('leads').select('id').eq('phone', phone).maybeSingle()
      if (byPhone?.id) {
        await supabase.from('portal_events').insert({
          portal: lead.portal_source,
          raw_payload: lead.raw_payload as object,
          lead_id: byPhone.id,
          duplicate: true,
          error: 'phone_unique_conflict',
        } as never)
        return { duplicate: true, lead_id: byPhone.id }
      }
    }
    await supabase.from('portal_events').insert({
      portal: lead.portal_source,
      raw_payload: lead.raw_payload as object,
      error: msg,
    } as never)
    throw new Error(msg)
  }

  const newLeadId = (newLead as { id: string }).id

  void onLeadCreated(supabase, {
    leadId: newLeadId,
    agentId,
    source: sourceDisplay,
    channel: lead.portal_source,
    status: 'new',
  })

  await supabase.from('portal_events').insert({
    portal: lead.portal_source,
    raw_payload: lead.raw_payload as object,
    lead_id: newLeadId,
    duplicate: false,
  } as never)

  const propertyLine = lead.property_address?.trim()
    ? `They mentioned interest related to: ${lead.property_address.trim()}.`
    : 'They submitted a property inquiry online.'
  const locationLine = lead.location?.trim()
    ? `They are looking in or near: ${lead.location.trim()}.`
    : ''

  const { data: logRow, error: logErr } = await supabase
    .from('speed_to_lead_log')
    .insert({
      lead_id: newLeadId,
      source: sourceDisplay,
      property_interest: lead.property_address?.trim() || null,
      budget: null,
      received_at: now,
      call_status: 'pending',
    } as never)
    .select('id')
    .single()

  if (logErr || !logRow) {
    console.error('[portal-intake] speed_to_lead_log insert error:', logErr)
  } else {
    const speedLogId = (logRow as { id: string }).id
    void (async () => {
      try {
        await triggerSpeedToLeadVapi(supabase, {
          speedLogId,
          leadId: newLeadId,
          name: lead.name.trim() || 'Unknown',
          phone,
          sourceLabel: sourceDisplay,
          propertyLine,
          locationLine,
          portal: lead.portal_source,
        })
        const calledAt = new Date()
        const seconds = Math.round((calledAt.getTime() - receivedAt.getTime()) / 1000)
        await supabase
          .from('leads')
          .update({
            first_call_at: calledAt.toISOString(),
            speed_to_lead_seconds: seconds,
            updated_at: calledAt.toISOString(),
          } as never)
          .eq('id', newLeadId)

        const { data: leadSms } = await supabase
          .from('leads')
          .select('name, phone, agent_id, location, budget_mentioned')
          .eq('id', newLeadId)
          .maybeSingle()
        const row = leadSms as {
          name: string
          phone: string
          agent_id: string | null
          location: string | null
          budget_mentioned: string | null
        } | null
        if (row?.agent_id) {
          const { data: ag } = await supabase.from('agents').select('phone').eq('id', row.agent_id).maybeSingle()
          const aphone = (ag as { phone: string | null } | null)?.phone
          if (aphone) {
            const budgetStr = row.budget_mentioned?.trim() || undefined
            await sendAgentSMSAlert({
              agentPhone: aphone,
              leadName: row.name || 'Lead',
              leadPhone: row.phone,
              score: 0,
              scoreLabel: 'Speed lead',
              leadType: 'buyer',
              urgency: 'normal',
              location: row.location,
              budget: budgetStr,
            })
          }
        }
      } catch (e) {
        console.error('[portal-intake] Outbound VAPI failed:', e)
      }
    })()
  }

  return { duplicate: false, lead_id: newLeadId }
}
