import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { toE164 } from '../../lib/phone-e164'
import { openHouseBranchingSystemPrompt } from '../../lib/vapi-priya-branching-prompt'
import { sendAgentSMSAlert } from './sms-alert'

export function getOpenHouseSupabase(): SupabaseClient {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) {
    throw new Error('Supabase is not configured for open house follow-up')
  }
  return createClient(url, key)
}

function speedWebhookBaseUrl(): string {
  return (
    process.env.SPEED_WEBHOOK_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'http://localhost:3002'
  ).replace(/\/$/, '')
}

export interface FollowUpInput {
  attendeeId: string
  openHouseId: string
  address: string
  agentId: string | null
  name: string
  phone: string
  leadId: string | null
}

export async function triggerOpenHouseFollowUp(input: FollowUpInput): Promise<{ success: boolean; error?: string }> {
  const supabase = getOpenHouseSupabase()
  const firstName = input.name.trim().split(/\s+/)[0] || input.name.trim() || 'there'
  const now = new Date().toISOString()

  const apiKey = process.env.VAPI_API_KEY || process.env.VITE_VAPI_API_KEY
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID || process.env.VITE_VAPI_PHONE_NUMBER_ID

  if (!apiKey || !phoneNumberId) {
    console.warn('[open-house-followup] VAPI not configured')
    await supabase.from('open_house_attendees').update({ follow_up_status: 'call_failed' }).eq('id', input.attendeeId)
    return { success: false, error: 'VAPI not configured' }
  }

  const number = toE164(input.phone)
  if (!number || number.replace(/\D/g, '').length < 8) {
    await supabase.from('open_house_attendees').update({ follow_up_status: 'call_failed' }).eq('id', input.attendeeId)
    return { success: false, error: 'Invalid phone' }
  }

  let leadId = input.leadId

  if (!leadId) {
    const { data: existing } = await supabase.from('leads').select('id').eq('phone', number).maybeSingle()
    if (existing?.id) {
      leadId = (existing as { id: string }).id
    } else {
      const { data: newLead, error: insErr } = await supabase
        .from('leads')
        .insert({
          name: input.name.trim() || 'Unknown',
          phone: number,
          email: null,
          source: 'Open House',
          agent_id: input.agentId,
          status: 'new',
          updated_at: now,
        } as never)
        .select('id')
        .single()

      if (insErr || !newLead) {
        console.error('[open-house-followup] Lead insert failed:', insErr?.message)
        await supabase.from('open_house_attendees').update({ follow_up_status: 'call_failed' }).eq('id', input.attendeeId)
        return { success: false, error: insErr?.message || 'Lead insert failed' }
      }
      leadId = (newLead as { id: string }).id
    }

    await supabase.from('open_house_attendees').update({ lead_id: leadId }).eq('id', input.attendeeId)
  }

  const { data: logRow, error: logErr } = await supabase
    .from('speed_to_lead_log')
    .insert({
      lead_id: leadId,
      source: 'Open House follow-up',
      property_interest: input.address,
      budget: null,
      received_at: now,
      call_status: 'pending',
    } as never)
    .select('id')
    .single()

  if (logErr || !logRow) {
    console.error('[open-house-followup] speed_to_lead_log insert failed:', logErr?.message)
    await supabase.from('open_house_attendees').update({ follow_up_status: 'call_failed' }).eq('id', input.attendeeId)
    return { success: false, error: logErr?.message || 'speed_to_lead_log insert failed' }
  }

  const speedLogId = (logRow as { id: string }).id
  const serverUrl = `${speedWebhookBaseUrl()}/api/vapi/speed-webhook`

  const systemContent = openHouseBranchingSystemPrompt({
    firstName,
    address: input.address,
  })

  const firstMessage = `Hi ${firstName}! This is Sarah calling — thanks for stopping by ${input.address} today. Did you have any questions about the property?`

  try {
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
          name: input.name.trim() || 'Guest',
        },
        assistant: {
          name: 'Sarah',
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
          maxDurationSeconds: 180,
          serverUrl,
          metadata: {
            leadId,
            speedLogId,
            source: 'Open House follow-up',
            type: 'open_house_followup',
            openHouseId: input.openHouseId,
          },
        },
      }),
    })

    const triggeredAt = new Date().toISOString()

    if (!response.ok) {
      const errText = await response.text()
      console.error('[open-house-followup] VAPI error:', errText)
      await supabase
        .from('speed_to_lead_log')
        .update({ call_status: 'failed', call_triggered_at: triggeredAt })
        .eq('id', speedLogId)
      await supabase.from('open_house_attendees').update({ follow_up_status: 'call_failed' }).eq('id', input.attendeeId)
      return { success: false, error: errText }
    }

    const data = (await response.json()) as { id?: string }
    if (!data.id) {
      await supabase.from('open_house_attendees').update({ follow_up_status: 'call_failed' }).eq('id', input.attendeeId)
      return { success: false, error: 'VAPI did not return call id' }
    }

    await supabase
      .from('speed_to_lead_log')
      .update({
        call_status: 'calling',
        vapi_call_id: data.id,
        call_triggered_at: triggeredAt,
      })
      .eq('id', speedLogId)

    await supabase
      .from('open_house_attendees')
      .update({
        follow_up_status: 'call_triggered',
        call_triggered_at: triggeredAt,
      })
      .eq('id', input.attendeeId)

    if (leadId && input.agentId) {
      const { data: ag } = await supabase.from('agents').select('phone').eq('id', input.agentId).maybeSingle()
      const aphone = (ag as { phone: string | null } | null)?.phone
      if (aphone) {
        const { data: lr } = await supabase
          .from('leads')
          .select('name, phone, location, budget_mentioned')
          .eq('id', leadId)
          .maybeSingle()
        const leadRow = lr as {
          name: string
          phone: string
          location: string | null
          budget_mentioned: string | null
        } | null
        const budgetStr = leadRow?.budget_mentioned?.trim() || undefined
        await sendAgentSMSAlert({
          agentPhone: aphone,
          leadName: leadRow?.name || input.name.trim() || 'Guest',
          leadPhone: leadRow?.phone || number,
          score: 0,
          scoreLabel: 'Open house follow-up',
          leadType: 'buyer',
          urgency: 'normal',
          location: leadRow?.location,
          budget: budgetStr,
        })
      }
    }

    return { success: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('[open-house-followup]', e)
    await supabase.from('open_house_attendees').update({ follow_up_status: 'call_failed' }).eq('id', input.attendeeId)
    return { success: false, error: msg }
  }
}
