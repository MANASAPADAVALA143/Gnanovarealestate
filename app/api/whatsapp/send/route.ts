import { NextRequest, NextResponse } from 'next/server'
import { isAgentAuth, requireAgent } from '@/lib/require-agent'

export const runtime = 'nodejs'

async function sendTwilioWhatsApp(to: string, body: string): Promise<string | null> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_WHATSAPP_FROM
  if (!sid || !token || !from) {
    throw new Error('Twilio WhatsApp is not configured')
  }
  const twilio = (await import('twilio')).default
  const client = twilio(sid, token)
  const digits = to.replace(/\D/g, '')
  const toWa = to.startsWith('whatsapp:') ? to : `whatsapp:+${digits}`
  const fromWa = from.startsWith('whatsapp:') ? from : `whatsapp:${from}`
  const msg = await client.messages.create({ from: fromWa, to: toWa, body })
  return msg.sid || null
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAgent(req)
    if (!isAgentAuth(auth)) return auth

    const body = (await req.json()) as { to?: string; message?: string }
    const to = (body.to || '').trim()
    const message = (body.message || '').trim()
    if (!to || !message) {
      return NextResponse.json({ error: 'to and message are required' }, { status: 400 })
    }

    const sid = await sendTwilioWhatsApp(to, message)
    return NextResponse.json({ ok: true, sid })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
