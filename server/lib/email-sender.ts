import { Resend } from 'resend'

export type FollowUpLead = {
  id?: string | null
  name: string | null
  email: string | null
  phone?: string | null
  lead_source?: string | null
  score_label?: string | null
}

export type FollowUpCallSummary = {
  duration_seconds?: number | null
  outcome?: string | null
  transcript_summary?: string | null
}

export type SendEmailResult = {
  success: boolean
  error?: string
  providerId?: string
  subject: string
  recipient: string
}

function fromAddress(): string {
  return (
    process.env.FROM_EMAIL?.trim() ||
    process.env.RESEND_FROM_EMAIL?.trim() ||
    'noreply@gnanova.pro'
  )
}

function normalizeScoreLabel(raw: string | null | undefined): 'hot' | 'warm' | 'cold' {
  const s = String(raw || '').trim().toLowerCase()
  if (s === 'hot') return 'hot'
  if (s === 'warm') return 'warm'
  return 'cold'
}

function buildSubject(name: string): string {
  return `Thank you for your interest, ${name} — Next Steps`
}

function buildHtml(lead: FollowUpLead, _summary: FollowUpCallSummary): string {
  const name = (lead.name || 'there').trim() || 'there'
  const score = normalizeScoreLabel(lead.score_label)

  let fitParagraph =
    "We'll keep you updated on new listings that match your requirements."
  if (score === 'hot') {
    fitParagraph =
      "Based on our conversation, you're a great fit — one of our senior agents will call you within 2 hours."
  } else if (score === 'warm') {
    fitParagraph =
      "We'd love to find the perfect property for you. Expect a follow-up from our team within 24 hours."
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td style="background:#0b1f3a;padding:20px 28px;">
              <div style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.02em;">Gnanova Real Estate</div>
              <div style="color:#94a3b8;font-size:12px;margin-top:4px;">Dubai</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 16px;font-size:16px;">Hi ${escapeHtml(name)},</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#334155;">
                Thank you for speaking with us today about your property search in Dubai.
              </p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#334155;">
                ${escapeHtml(fitParagraph)}
              </p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:#334155;">
                In the meantime, feel free to reply to this email with any questions.
              </p>
              <p style="margin:0;font-size:14px;line-height:1.5;color:#64748b;">
                The Gnanova Real Estate Team | Dubai
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Send post-call follow-up via Resend.
 * Never throws for missing API key — returns { success: false }.
 */
export async function sendPostCallFollowUp(
  lead: FollowUpLead,
  callSummary: FollowUpCallSummary
): Promise<SendEmailResult> {
  const recipient = String(lead.email || '').trim()
  const displayName = (lead.name || 'there').trim() || 'there'
  const subject = buildSubject(displayName)

  if (!recipient) {
    return { success: false, error: 'no_email', subject, recipient: '' }
  }

  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) {
    console.warn('[email-sender] RESEND_API_KEY not set — skipping send')
    return { success: false, error: 'no_api_key', subject, recipient }
  }

  try {
    const resend = new Resend(apiKey)
    const html = buildHtml(lead, callSummary)
    const { data, error } = await resend.emails.send({
      from: fromAddress(),
      to: [recipient],
      subject,
      html,
    })

    if (error) {
      return {
        success: false,
        error: error.message || 'resend_error',
        subject,
        recipient,
      }
    }

    return {
      success: true,
      providerId: data?.id,
      subject,
      recipient,
    }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'send_failed',
      subject,
      recipient,
    }
  }
}
