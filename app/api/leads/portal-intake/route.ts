import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseServiceClient } from '../../../../lib/supabase-service'
import { normalizePhone } from '../../../../lib/bulk-import-helpers'
import { toE164 } from '../../../../lib/phone-e164'
import { onLeadCreated } from '../../../../lib/crm-hooks'

export const runtime = 'nodejs'
export const maxDuration = 60

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'http://localhost:3002'
  ).replace(/\/$/, '')
}

export async function POST(req: NextRequest) {
  const expected = process.env.WEBHOOK_SECRET
  if (!expected) {
    console.error('[portal-intake] WEBHOOK_SECRET is not configured')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 503 })
  }

  const token = req.headers.get('x-webhook-secret')
  if (token !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const str = (v: unknown) => (typeof v === 'string' ? v : v != null ? String(v) : '')

  const name =
    str(body.name) ||
    str(body.full_name) ||
    str(body.contact_name) ||
    'Unknown'
  const phoneRaw =
    str(body.phone) ||
    str(body.mobile) ||
    str(body.phone_number) ||
    str(body.contact)
  const emailRaw = str(body.email) || str(body.email_address)
  const email = emailRaw.trim() || null
  const locationRaw =
    str(body.location) ||
    str(body.area) ||
    str(body.city) ||
    str(body.locality)
  const location = locationRaw.trim() || null
  const source = str(body.source) || str(body.portal) || 'portal'
  const propertyInterest =
    str(body.property) || str(body.property_title) || str(body.listing) || null
  const budget = str(body.budget) || str(body.price_range) || null

  const phone = normalizePhone(phoneRaw)
  if (!phone || phone.length < 8) {
    return NextResponse.json({ error: 'Phone number required' }, { status: 400 })
  }

  const supabase = getSupabaseServiceClient()
  const now = new Date().toISOString()

  const { data: lead, error } = await supabase
    .from('leads')
    .upsert(
      {
        name: name.trim() || 'Unknown',
        phone,
        email,
        location,
        source,
        status: 'new',
        updated_at: now,
      },
      { onConflict: 'phone' }
    )
    .select()
    .single()

  if (error || !lead) {
    console.error('[portal-intake] Lead upsert error:', error)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  const leadRow = lead as { id: string; agent_id?: string | null; created_at?: string }

  void onLeadCreated(supabase, {
    leadId: leadRow.id,
    agentId: leadRow.agent_id ?? null,
    source,
    channel: 'portal_intake',
    status: 'new',
  })

  const { data: logRow, error: logErr } = await supabase
    .from('speed_to_lead_log')
    .insert({
      lead_id: leadRow.id,
      source,
      property_interest: propertyInterest,
      budget,
      received_at: now,
      call_status: 'pending',
    })
    .select('id')
    .single()

  if (logErr || !logRow) {
    console.error('[portal-intake] speed_to_lead_log insert error:', logErr)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  const speedLogId = (logRow as { id: string }).id

  void triggerVAPICall(supabase, {
    speedLogId,
    leadId: leadRow.id,
    name: name.trim() || 'Unknown',
    phone,
    source,
    propertyInterest,
    location,
  }).catch((err) => console.error('[portal-intake] VAPI trigger failed:', err))

  return NextResponse.json({
    received: true,
    leadId: leadRow.id,
    speedLogId,
    callTriggered: true,
  })
}

async function triggerVAPICall(
  supabase: SupabaseClient,
  params: {
    speedLogId: string
    leadId: string
    name: string
    phone: string
    source: string
    propertyInterest: string | null
    location: string | null
  }
) {
  const apiKey = process.env.VAPI_API_KEY || process.env.VITE_VAPI_API_KEY
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID || process.env.VITE_VAPI_PHONE_NUMBER_ID
  if (!apiKey || !phoneNumberId) {
    console.warn('[portal-intake] VAPI not configured; skipping outbound call')
    await supabase
      .from('speed_to_lead_log')
      .update({ call_status: 'skipped_no_vapi' })
      .eq('id', params.speedLogId)
    return
  }

  const propertyLine = params.propertyInterest
    ? `I saw you were interested in ${params.propertyInterest}.`
    : 'I saw you were looking at properties in our listings.'

  const locationLine = params.location
    ? `Are you still looking for properties in ${params.location}?`
    : 'Which area are you looking in?'

  const firstMessage = `Hello ${params.name}, this is Priya calling. ${propertyLine} Do you have 2 minutes?`

  const systemContent = `You are Priya, a friendly real estate assistant.
This lead just enquired about a property online — call them within 60 seconds of their enquiry.

Your goals in this call:
1. Confirm their interest: ${propertyLine}
2. Ask: ${locationLine}
3. Ask their budget range
4. Ask their timeline — ready to buy now, 3 months, or just exploring?
5. If serious (has budget + timeline within 3 months): offer to book a site visit or send more details
6. If exploring: tell them you will send more info and follow up next week

Keep the call under 3 minutes. Be warm and natural. They just filled a form so they are expecting a call.`

  const number = toE164(params.phone)
  const serverUrl = `${appBaseUrl()}/api/vapi/speed-webhook`

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
          messages: [
            {
              role: 'system',
              content: systemContent,
            },
          ],
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
          source: params.source,
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
      .update({
        call_status: 'failed',
        call_triggered_at: triggeredAt,
      })
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

  return data
}
