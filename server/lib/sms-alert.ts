import twilio from 'twilio'
import { toE164 } from '../../lib/phone-e164'

export interface AlertInput {
  agentPhone: string
  leadName: string
  leadPhone: string
  score: number
  scoreLabel: string
  leadType: string
  urgency: string
  location?: string | null
  budget?: string | null
}

let twilioClient: ReturnType<typeof twilio> | null | undefined

function getTwilioClient(): ReturnType<typeof twilio> | null {
  if (twilioClient === undefined) {
    const sid = process.env.TWILIO_ACCOUNT_SID
    const token = process.env.TWILIO_AUTH_TOKEN
    twilioClient = sid && token ? twilio(sid, token) : null
  }
  return twilioClient
}

function scoreLabelForEmoji(label: string): string {
  const u = label.trim().toLowerCase()
  if (u.includes('hot')) return 'Hot'
  if (u.includes('warm')) return 'Warm'
  if (u.includes('dead') || u.includes('cold')) return label.trim() || 'Cold'
  return label.trim() || 'Cold'
}

export async function sendAgentSMSAlert(input: AlertInput): Promise<{ success: boolean; error?: string }> {
  const client = getTwilioClient()
  const from = process.env.TWILIO_PHONE_NUMBER
  if (!client || !from) {
    console.warn('[sms-alert] Twilio not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER)')
    return { success: false, error: 'Twilio not configured' }
  }

  const urgencyFlag = input.urgency === 'high' ? '🔴 URGENT — ' : ''
  const sl = scoreLabelForEmoji(input.scoreLabel)
  const emoji = sl === 'Hot' ? '🔥' : sl === 'Warm' ? '⚡' : '❄️'

  const message =
    `${urgencyFlag}${emoji} New ${sl} ${input.leadType} lead!\n\n` +
    `Name: ${input.leadName}\n` +
    `Phone: ${input.leadPhone}\n` +
    `Score: ${input.score}/100\n` +
    `Type: ${input.leadType}\n` +
    `Location: ${input.location?.trim() || 'Not specified'}\n` +
    `Budget: ${input.budget?.trim() || 'Not specified'}\n\n` +
    `Log in to Gnanova to view transcript and call recording.`

  const to = toE164(input.agentPhone)
  if (!to || to.replace(/\D/g, '').length < 8) {
    console.warn('[sms-alert] Invalid agent phone; skipping SMS')
    return { success: false, error: 'Invalid agent phone' }
  }

  try {
    await client.messages.create({
      body: message,
      from,
      to,
    })
    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[sms-alert] SMS alert failed:', msg)
    return { success: false, error: msg }
  }
}

/** Plain SMS to an agent (e.g. Hot lead reassigned away after merit routing). */
export async function sendAgentPlainSms(input: {
  agentPhone: string
  body: string
}): Promise<{ success: boolean; error?: string }> {
  const client = getTwilioClient()
  const from = process.env.TWILIO_PHONE_NUMBER
  if (!client || !from) {
    console.warn('[sms-alert] Twilio not configured; skipping plain SMS')
    return { success: false, error: 'Twilio not configured' }
  }

  const to = toE164(input.agentPhone)
  if (!to || to.replace(/\D/g, '').length < 8) {
    console.warn('[sms-alert] Invalid agent phone; skipping plain SMS')
    return { success: false, error: 'Invalid agent phone' }
  }

  try {
    await client.messages.create({
      body: input.body,
      from,
      to,
    })
    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[sms-alert] plain SMS failed:', msg)
    return { success: false, error: msg }
  }
}
