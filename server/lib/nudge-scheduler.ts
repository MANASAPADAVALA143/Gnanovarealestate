import { createClient } from '@supabase/supabase-js'
import twilio from 'twilio'
import { toE164 } from '../../lib/phone-e164'

function getSupabase() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
  if (!url || !key) return null
  return createClient(url, key)
}

let twilioClient: ReturnType<typeof twilio> | null | undefined

function getTwilio(): ReturnType<typeof twilio> | null {
  if (twilioClient === undefined) {
    const sid = process.env.TWILIO_ACCOUNT_SID
    const token = process.env.TWILIO_AUTH_TOKEN
    twilioClient = sid && token ? twilio(sid, token) : null
  }
  return twilioClient
}

export async function runNudgeScheduler(): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) {
    console.warn('[nudge-scheduler] Supabase not configured; skipping run')
    return
  }
  const twilioInst = getTwilio()
  const from = process.env.TWILIO_PHONE_NUMBER
  if (!twilioInst || !from) {
    console.warn('[nudge-scheduler] Twilio not configured; skipping run')
    return
  }

  const cutoff = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString()

  const { data: leads, error } = await supabase
    .from('leads')
    .select('id, name, phone, lead_type, location, agent_id, nudge_count, status')
    .lte('created_at', cutoff)
    .eq('nudge_count', 0)
    .not('status', 'in', '(closed,lost,disqualified,qualified)')
    .not('phone', 'is', null)
    .neq('phone', '')
    .limit(50)

  if (error) {
    console.error('[nudge-scheduler] query failed:', error.message)
    return
  }

  if (!leads?.length) return

  for (const lead of leads as Array<{
    id: string
    name: string | null
    phone: string
    lead_type: string | null
    location: string | null
    agent_id: string | null
    nudge_count: number | null
    status: string | null
  }>) {
    const e164 = toE164(lead.phone)
    if (!e164 || e164.replace(/\D/g, '').length < 8) continue

    const firstName = lead.name?.split(/\s+/)[0] || 'there'
    const lt = (lead.lead_type || 'buyer').toLowerCase()

    let message = ''
    if (lt === 'seller') {
      message =
        `Hi ${firstName}! This is the Gnanova Real Estate team. ` +
        `We'd love to help you get the best price for your property. ` +
        `Reply YES to get a free valuation, or call us anytime. 🏠`
    } else if (lt === 'renter') {
      message =
        `Hi ${firstName}! Gnanova Real Estate here. ` +
        `We have some great rental options in ${lead.location || 'your area'}. ` +
        `Reply YES and we'll send you the list. 🏠`
    } else {
      message =
        `Hi ${firstName}! Gnanova Real Estate here. ` +
        `We have some exciting properties in ${lead.location || 'your preferred area'} ` +
        `that match your requirements. ` +
        `Reply YES and we'll send you the details. 🏠`
    }

    try {
      await twilioInst.messages.create({
        body: message,
        from,
        to: e164,
      })

      await supabase.from('lead_nudges').insert({
        lead_id: lead.id,
        channel: 'sms',
        message,
        status: 'sent',
      } as never)

      await supabase
        .from('leads')
        .update({
          nudge_sent_at: new Date().toISOString(),
          nudge_count: 1,
        } as never)
        .eq('id', lead.id)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[nudge-scheduler] Nudge failed for lead ${lead.id}:`, msg)
      await supabase.from('lead_nudges').insert({
        lead_id: lead.id,
        channel: 'sms',
        message,
        status: 'failed',
      } as never)
    }
  }
}
