/** Normalize Cal.com v1 /v1/slots response into { date, time } rows */
export function normalizeCalSlots(payload: unknown): { date: string; time: string }[] {
  if (!payload || typeof payload !== 'object') return []
  const root = payload as Record<string, unknown>
  const slots = root.slots
  if (!slots || typeof slots !== 'object') return []
  const out: { date: string; time: string }[] = []
  for (const [dateStr, times] of Object.entries(slots as Record<string, unknown>)) {
    if (!Array.isArray(times)) continue
    for (const entry of times) {
      if (typeof entry === 'string') {
        out.push({ date: dateStr, time: entry.slice(0, 5) })
        continue
      }
      if (entry && typeof entry === 'object') {
        const o = entry as Record<string, string>
        const raw = o.time || o.start || ''
        if (typeof raw === 'string') {
          const t = raw.includes('T') ? raw.split('T')[1]?.slice(0, 5) : raw.slice(0, 5)
          if (t) out.push({ date: dateStr, time: t })
        }
      }
    }
  }
  return out
}

/** Weekday business-hour placeholders when Cal.com is off or fails */
export function generateDefaultSlotsForDate(dateStr: string): { date: string; time: string }[] {
  return generateHalfHourSlots9to6(dateStr)
}

/** Weekdays only: 9:00 AM – 6:00 PM in 30-minute steps (last slot 17:30). */
export function generateHalfHourSlots9to6(dateStr: string): { date: string; time: string }[] {
  const d = new Date(`${dateStr}T12:00:00`)
  const day = d.getDay()
  if (day === 0 || day === 6) return []
  const out: { date: string; time: string }[] = []
  for (let mins = 9 * 60; mins < 18 * 60; mins += 30) {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    out.push({ date: dateStr, time })
  }
  return out
}

export async function fetchCalComSlotsFromServer(body: {
  apiKey: string
  username: string
  eventTypeId: string
  startDate: string
  endDate: string
}): Promise<{ ok: boolean; slots?: { date: string; time: string }[]; error?: string }> {
  try {
    const res = await fetch('/api/calcom/slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json.success) {
      return { ok: false, error: json.error || `HTTP ${res.status}` }
    }
    return { ok: true, slots: normalizeCalSlots(json.slots) }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error'
    return { ok: false, error: msg }
  }
}
