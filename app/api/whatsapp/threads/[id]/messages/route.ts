import { NextRequest, NextResponse } from 'next/server'
import { isAgentAuth, requireAgent } from '@/lib/require-agent'
import { getSupabaseServiceClient } from '@/lib/supabase-service'

export const runtime = 'nodejs'

async function sendTwilioWhatsApp(to: string, body: string): Promise<string | null> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_WHATSAPP_FROM
  if (!sid || !token || !from) return null
  const twilio = (await import('twilio')).default
  const client = twilio(sid, token)
  const toWa = to.startsWith('whatsapp:') ? to : `whatsapp:${to.startsWith('+') ? to : `+${to}`}`
  const fromWa = from.startsWith('whatsapp:') ? from : `whatsapp:${from}`
  const msg = await client.messages.create({ from: fromWa, to: toWa, body })
  return msg.sid || null
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAgent(req)
    if (!isAgentAuth(auth)) return auth
    const threadId = params.id?.trim()
    const supabase = getSupabaseServiceClient()
    const { data, error } = await supabase
      .from('whatsapp_thread_messages')
      .select('id, thread_id, direction, sender_type, sender_agent_id, body, media_url, created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .limit(500)
    if (error) throw new Error(error.message)

    await supabase.from('whatsapp_threads').update({ unread_count: 0 }).eq('id', threadId)

    return NextResponse.json({ messages: data || [] })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAgent(req)
    if (!isAgentAuth(auth)) return auth
    const threadId = params.id?.trim()
    const body = (await req.json()) as { body?: string }
    const text = (body.body || '').trim()
    if (!text) return NextResponse.json({ error: 'body is required' }, { status: 400 })

    const supabase = getSupabaseServiceClient()
    const { data: thread, error: threadErr } = await supabase
      .from('whatsapp_threads')
      .select('id, phone_number')
      .eq('id', threadId)
      .maybeSingle()
    if (threadErr) throw new Error(threadErr.message)
    if (!thread) return NextResponse.json({ error: 'Thread not found' }, { status: 404 })

    let twilioSid: string | null = null
    try {
      twilioSid = await sendTwilioWhatsApp(thread.phone_number, text)
    } catch (err) {
      console.warn('[whatsapp reply] Twilio send failed:', err)
    }

    const { data, error } = await supabase
      .from('whatsapp_thread_messages')
      .insert({
        thread_id: threadId,
        direction: 'outbound',
        sender_type: 'agent',
        sender_agent_id: auth.agentId,
        body: text,
        twilio_message_sid: twilioSid,
      })
      .select('id, thread_id, direction, sender_type, body, created_at')
      .single()
    if (error) throw new Error(error.message)

    return NextResponse.json({ message: data }, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
