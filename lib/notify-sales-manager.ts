import type { SupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { sendWhatsAppOutbound } from '../server/lib/whatsapp-inbox.ts'
import { recordLeadActivity } from './crm-hooks'
import { toE164 } from './phone-e164'
import type { AutomationLead, AutomationStatus } from './workspace-automations'
import type { ResolvedWorkspace } from './workspace-server'

export type ManagerAlertOutcome = {
  whatsapp: AutomationStatus
  email: AutomationStatus
}

type Detail = { label: string; value: string }

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function crmLink(leadId: string): string {
  const base = (process.env.CRM_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/$/, '')
  return base ? `${base}/dashboard/leads/${leadId}` : ''
}

function sourceEmoji(source: string): string {
  const s = source.toLowerCase()
  if (s.includes('instagram')) return '📸'
  if (s.includes('facebook')) return '📘'
  if (s.includes('whatsapp')) return '💬'
  if (s.includes('youtube')) return '▶️'
  if (s.includes('google')) return '🔍'
  if (s.includes('99acres') || s.includes('magicbricks') || s.includes('housing')) return '🏠'
  if (s.includes('website') || s.includes('landing')) return '🌐'
  return '📣'
}

/** Workspace custom fields (villa size, budget, …) that the lead actually filled in. */
function customDetails(workspace: ResolvedWorkspace, lead: AutomationLead): Detail[] {
  const custom = lead.custom_fields || {}
  const out: Detail[] = []
  for (const field of workspace.leadFields) {
    if (!field.customKey) continue
    const value = custom[field.customKey]
    if (value == null || String(value).trim() === '') continue
    out.push({ label: field.label, value: String(value).trim() })
  }
  return out
}

function receivedAt(): string {
  return new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
}

async function sendManagerWhatsApp(
  workspace: ResolvedWorkspace,
  lead: AutomationLead,
  details: Detail[],
  rawNumber: string | undefined
): Promise<AutomationStatus> {
  const to = rawNumber ? toE164(rawNumber) : ''
  if (!to) return 'skipped'

  const source = lead.source || 'Unknown'
  const link = crmLink(lead.id)
  const lines = [
    `${sourceEmoji(source)} *New Lead — ${workspace.name}*`,
    '',
    `👤 Name: ${lead.name}`,
    `📞 Phone: ${lead.phone}`,
    `📧 Email: ${lead.email || '—'}`,
    ...details.map((d) => `• ${d.label}: ${d.value}`),
    ...(lead.location ? [`📍 Location: ${lead.location}`] : []),
    `📢 Source: ${source}`,
    `⏰ Time: ${receivedAt()}`,
    '',
    '*Please contact this lead within 5 minutes!*',
    ...(link ? ['', `🔗 Open in CRM: ${link}`] : []),
  ]

  try {
    return (await sendWhatsAppOutbound(to, lines.join('\n'))) ? 'done' : 'skipped'
  } catch (e) {
    console.error('[manager-alert] WhatsApp failed:', e)
    return 'failed'
  }
}

async function sendManagerEmail(
  workspace: ResolvedWorkspace,
  lead: AutomationLead,
  details: Detail[],
  recipient: string | undefined,
  managerName: string
): Promise<AutomationStatus> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!recipient || !apiKey) return 'skipped'

  const source = lead.source || 'Unknown'
  const link = crmLink(lead.id)
  const rows: Detail[] = [
    { label: 'Name', value: lead.name },
    { label: 'Phone', value: lead.phone },
    { label: 'Email', value: lead.email || '—' },
    ...details,
    { label: 'Location', value: lead.location || '—' },
    { label: 'Source', value: source },
    { label: 'Received at', value: `${receivedAt()} IST` },
  ]
  const project = escapeHtml(workspace.name)

  const rowsHtml = rows
    .map(
      (r, i) => `<tr${i % 2 === 0 ? ' style="background:#f8fafc;"' : ''}>
        <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#64748b;width:38%;border-top:1px solid #f1f5f9;">${escapeHtml(r.label)}</td>
        <td style="padding:10px 16px;font-size:14px;color:#0f172a;border-top:1px solid #f1f5f9;">${
          r.label === 'Phone'
            ? `<a href="tel:${escapeHtml(lead.phone)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(r.value)}</a>`
            : escapeHtml(r.value)
        }</td>
      </tr>`
    )
    .join('')

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="580" cellspacing="0" cellpadding="0"
             style="max-width:580px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr>
          <td style="background:#0b1f3a;padding:20px 28px;">
            <div style="color:#ffffff;font-size:18px;font-weight:700;">🔔 New Lead Alert</div>
            <div style="color:#94a3b8;font-size:13px;margin-top:4px;">${project} — Gnanova CRM</div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <p style="margin:0 0 16px;font-size:15px;">Hi ${escapeHtml(managerName)},</p>
            <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#334155;">
              A new lead just arrived. <strong>Please contact them within 5 minutes</strong> to maximise conversion.
            </p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                   style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:24px;">
              ${rowsHtml}
            </table>
            ${
              link
                ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom:24px;">
              <tr>
                <td style="background:#2563eb;border-radius:8px;padding:12px 24px;">
                  <a href="${escapeHtml(link)}" style="color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">View Lead in CRM →</a>
                </td>
              </tr>
            </table>`
                : ''
            }
            <p style="margin:0;font-size:13px;color:#64748b;line-height:1.5;">Gnanova CRM · ${project}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  try {
    const { error } = await new Resend(apiKey).emails.send({
      from: process.env.FROM_EMAIL?.trim() || process.env.RESEND_FROM_EMAIL?.trim() || 'noreply@gnanova.pro',
      to: [recipient],
      subject: `🔔 New Lead: ${lead.name} (${source}) — ${workspace.name}`,
      html,
    })
    if (error) {
      console.error('[manager-alert] Resend error:', error)
      return 'failed'
    }
    return 'done'
  } catch (e) {
    console.error('[manager-alert] Email failed:', e)
    return 'failed'
  }
}

/** Alert the workspace's sales manager about a new lead over WhatsApp and email. Never throws. */
export async function notifySalesManager(
  supabase: SupabaseClient,
  workspace: ResolvedWorkspace,
  lead: AutomationLead
): Promise<ManagerAlertOutcome> {
  const cfg = workspace.automations.managerAlert
  if (!cfg) return { whatsapp: 'skipped', email: 'skipped' }

  const details = customDetails(workspace, lead)
  const managerName = process.env[cfg.nameEnv]?.trim() || 'Sales Manager'
  const [whatsapp, email] = await Promise.all([
    sendManagerWhatsApp(workspace, lead, details, process.env[cfg.whatsappEnv]?.trim()),
    sendManagerEmail(workspace, lead, details, process.env[cfg.emailEnv]?.trim(), managerName),
  ])

  const sent = [whatsapp === 'done' && 'WhatsApp', email === 'done' && 'email'].filter(Boolean)
  await recordLeadActivity(supabase, {
    leadId: lead.id,
    type: 'note',
    content: sent.length
      ? `Sales manager alerted via ${sent.join(' + ')}.`
      : `Sales manager alert not sent (WhatsApp: ${whatsapp}, email: ${email}). Check ${cfg.whatsappEnv}, ${cfg.emailEnv}, WHATSAPP_TOKEN and RESEND_API_KEY.`,
  })

  return { whatsapp, email }
}
