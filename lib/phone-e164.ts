/** Best-effort E.164 for VAPI (India-first for 10-digit national numbers). */
export function toE164(phone: string): string {
  const t = String(phone || '').trim().replace(/\s/g, '')
  if (t.startsWith('+')) return t.replace(/[^\d+]/g, (c) => (c === '+' ? '+' : ''))
  const digits = t.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 10) return `+91${digits}`
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`
  if (digits.length >= 11 && digits.startsWith('91')) return `+${digits}`
  if (digits.length >= 10) return `+${digits}`
  return `+${digits}`
}
