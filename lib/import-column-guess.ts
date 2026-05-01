export const NAME_ALIASES = ['name', 'full_name', 'contact_name', 'fullname', 'contactname']
export const PHONE_ALIASES = ['phone', 'mobile', 'phone_number', 'contact', 'phonenumber', 'cell']
export const LOCATION_ALIASES = ['location', 'area', 'city', 'locality']
export const EMAIL_ALIASES = ['email', 'e-mail', 'mail']

export function normalizeHeader(h: string): string {
  return h.replace(/\ufeff/g, '').trim().toLowerCase().replace(/\s+/g, '_')
}

export function guessColumn(
  headers: string[],
  aliases: string[],
  preferred?: string | null
): string | null {
  const normalized = headers.map((h) => ({ raw: h, key: normalizeHeader(h) }))
  if (preferred) {
    const p = normalizeHeader(preferred)
    const hit = normalized.find((h) => h.key === p || h.raw === preferred)
    if (hit) return hit.raw
  }
  for (const { raw, key } of normalized) {
    if (aliases.includes(key)) return raw
  }
  for (const { raw, key } of normalized) {
    for (const a of aliases) {
      if (key.includes(a) || a.includes(key)) return raw
    }
  }
  return null
}
