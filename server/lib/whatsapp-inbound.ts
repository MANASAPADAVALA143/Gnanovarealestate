import twilio from 'twilio'
import type { Request } from 'express'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { recordLeadActivity } from '../../lib/crm-hooks.ts'
import {
  recordBotReplyToInbox,
  recordInboundToInbox,
  sendWhatsAppOutbound,
  shouldAutoReply,
} from './whatsapp-inbox.ts'

export type MatchedLead = {
  id: string
  name: string
  agent_id: string | null
  pipeline_stage: string | null
}

export type InboundWhatsAppPayload = {
  from: string
  body: string
  messageSid: string
  mediaUrl?: string | null
}

let twilioClient: ReturnType<typeof twilio> | null | undefined

function getSupabase(): SupabaseClient {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) {
    throw new Error('Supabase not configured (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)')
  }
  return createClient(url, key)
}

function getTwilioClient(): ReturnType<typeof twilio> | null {
  if (twilioClient === undefined) {
    const sid = process.env.TWILIO_ACCOUNT_SID
    const token = process.env.TWILIO_AUTH_TOKEN
    twilioClient = sid && token ? twilio(sid, token) : null
  }
  return twilioClient
}

/** Strip `whatsapp:` prefix and normalize to plain E.164-style number. */
export function stripWhatsAppPrefix(from: string): string {
  return from.replace(/^whatsapp:/i, '').trim()
}

function normalizeFromAddress(fromEnv: string | undefined): string | null {
  if (!fromEnv?.trim()) return null
  const t = fromEnv.trim()
  return t.startsWith('whatsapp:') ? t : `whatsapp:${t}`
}

export async function matchLeadByPhone(
  supabase: SupabaseClient,
  phone: string
): Promise<MatchedLead | null> {
  const plain = stripWhatsAppPrefix(phone)
  if (!plain) return null

  const { data, error } = await supabase
    .from('leads')
    .select('id, name, agent_id, pipeline_stage')
    .ilike('phone', `%${plain}%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[whatsapp-inbound] lead match error:', error.message)
    return null
  }

  return data as MatchedLead | null
}

export function buildAutoReplyText(lead: MatchedLead | null, stage?: string | null): string {
  if (!lead) {
    return 'Thanks for reaching out! An agent will contact you shortly.'
  }

  const name = lead.name?.trim() || 'there'
  const s = stage ?? lead.pipeline_stage ?? 'new'

  if (s === 'new' || s === 'contacted') {
    return (
      `Hi ${name}! Thanks for your message. One of our agents will follow up with you very shortly. ` +
      '— Gnanova Real Estate'
    )
  }

  if (s === 'viewing_scheduled') {
    return (
      `Hi ${name}! Your viewing is confirmed. Reply with any questions. — Gnanova Real Estate`
    )
  }

  return (
    `Hi ${name}! We received your message and will get back to you soon. — Gnanova Real Estate`
  )
}

async function sendWhatsAppReply(toRaw: string, body: string): Promise<string | null> {
  try {
    return await sendWhatsAppOutbound(toRaw, body)
  } catch {
    return null
  }
}

async function logWhatsAppMessage(
  supabase: SupabaseClient,
  params: {
    phone: string
    leadName: string | null
    messageSid: string
    body: string
    leadId: string | null
    fromNumber: string
  }
): Promise<void> {
  const { error } = await supabase.from('whatsapp_messages').insert({
    phone: params.phone,
    lead_name: params.leadName,
    twilio_sid: params.messageSid,
    status: 'inbound',
    provider: 'twilio',
    raw_payload: {
      direction: 'inbound',
      body: params.body,
      lead_id: params.leadId,
      from_number: params.fromNumber,
      message_sid: params.messageSid,
    },
    created_at: new Date().toISOString(),
  } as never)

  if (error) {
    console.error('[whatsapp-inbound] whatsapp_messages insert failed:', error.message)
  }
}

async function autoCloseFollowUpTasks(
  supabase: SupabaseClient,
  leadId: string,
  agentId: string | null
): Promise<void> {
  const { data: tasks, error } = await supabase
    .from('lead_tasks')
    .select('id, type')
    .eq('lead_id', leadId)
    .eq('status', 'pending')
    .in('type', ['follow_up_24h', 'follow_up_48h'])

  if (error || !tasks?.length) return

  for (const task of tasks as { id: string; type: string }[]) {
    const { error: updateErr } = await supabase
      .from('lead_tasks')
      .update({ status: 'completed' } as never)
      .eq('id', task.id)

    if (updateErr) {
      console.error('[whatsapp-inbound] task close failed:', updateErr.message)
      continue
    }

    await recordLeadActivity(supabase, {
      leadId,
      type: 'task',
      content: 'Auto-closed: lead replied on WhatsApp',
      createdBy: agentId,
    })
  }
}

export async function processInboundWhatsApp(payload: InboundWhatsAppPayload): Promise<string> {
  const supabase = getSupabase()
  const fromNumber = stripWhatsAppPrefix(payload.from)
  const body = (payload.body || '').trim()
  const lead = await matchLeadByPhone(supabase, fromNumber)

  if (!lead) {
    console.warn(`[whatsapp-inbound] Unmatched inbound number: ${fromNumber}`)
  }

  const { thread, duplicate } = await recordInboundToInbox(supabase, {
    phoneNumber: fromNumber,
    body,
    messageSid: payload.messageSid,
    mediaUrl: payload.mediaUrl,
    lead,
  })

  if (duplicate) {
    return ''
  }

  if (lead) {
    await recordLeadActivity(supabase, {
      leadId: lead.id,
      type: 'whatsapp',
      content: `Inbound: ${body || '(empty message)'}`,
      createdBy: null,
    })

    await autoCloseFollowUpTasks(supabase, lead.id, lead.agent_id)
  }

  await logWhatsAppMessage(supabase, {
    phone: fromNumber,
    leadName: lead?.name ?? null,
    messageSid: payload.messageSid,
    body,
    leadId: lead?.id ?? null,
    fromNumber,
  })

  if (!shouldAutoReply(thread.status)) {
    return ''
  }

  const replyText = buildAutoReplyText(lead)
  const outboundSid = await sendWhatsAppReply(payload.from, replyText)
  await recordBotReplyToInbox(supabase, thread.id, replyText, outboundSid)

  return replyText
}

export function validateTwilioRequest(req: Request): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const webhookUrl = process.env.TWILIO_WEBHOOK_URL
  const signature = req.headers['x-twilio-signature'] as string | undefined

  if (process.env.TWILIO_SKIP_SIGNATURE === 'true') {
    console.warn('[whatsapp-inbound] TWILIO_SKIP_SIGNATURE=true — skipping signature check')
    return true
  }

  if (!authToken || !webhookUrl) {
    console.warn('[whatsapp-inbound] TWILIO_AUTH_TOKEN or TWILIO_WEBHOOK_URL missing — rejecting request')
    return false
  }

  if (!signature) return false

  return twilio.validateRequest(authToken, signature, webhookUrl, req.body as Record<string, string>)
}

export function buildTwiMLReply(message: string): string {
  const response = new twilio.twiml.MessagingResponse()
  response.message(message)
  return response.toString()
}

export async function handleWhatsAppInboundWebhook(req: Request): Promise<{ twiml: string; status: number }> {
  if (!validateTwilioRequest(req)) {
    return { twiml: '<?xml version="1.0" encoding="UTF-8"?><Response></Response>', status: 403 }
  }

  const from = String(req.body?.From || '')
  const body = String(req.body?.Body || '')
  const messageSid = String(req.body?.MessageSid || '')
  const numMedia = Number(req.body?.NumMedia || 0)
  const mediaUrl = numMedia > 0 ? String(req.body?.MediaUrl0 || '') || null : null

  if (!from) {
    return { twiml: '<?xml version="1.0" encoding="UTF-8"?><Response></Response>', status: 400 }
  }

  const replyText = await processInboundWhatsApp({ from, body, messageSid, mediaUrl })

  // TwiML fallback if REST send is unavailable (sandbox / missing credentials)
  const client = getTwilioClient()
  const fromAddr = normalizeFromAddress(process.env.TWILIO_WHATSAPP_FROM)
  if (!client || !fromAddr) {
    return { twiml: buildTwiMLReply(replyText), status: 200 }
  }

  return { twiml: '<?xml version="1.0" encoding="UTF-8"?><Response></Response>', status: 200 }
}
