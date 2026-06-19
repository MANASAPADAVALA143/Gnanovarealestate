function webhookBaseUrl(): string {
  if (typeof import.meta !== 'undefined') {
    const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env
    const fromEnv = env?.VITE_WEBHOOK_URL?.replace(/\/$/, '')
    if (fromEnv) return fromEnv
  }
  return 'http://localhost:3001'
}

const WEBHOOK_BASE = webhookBaseUrl()

export const VIEWING_STATUSES = [
  'scheduled',
  'confirmed',
  'completed',
  'no_show',
  'cancelled',
] as const

export type ViewingStatus = (typeof VIEWING_STATUSES)[number]

export const VIEWING_STATUS_LABELS: Record<ViewingStatus, string> = {
  scheduled: 'Scheduled',
  confirmed: 'Confirmed',
  completed: 'Completed',
  no_show: 'No show',
  cancelled: 'Cancelled',
}

export const VIEWING_INTEREST_LEVELS = ['low', 'medium', 'high'] as const
export type ViewingInterestLevel = (typeof VIEWING_INTEREST_LEVELS)[number]

export const VIEWING_STATUS_BADGE: Record<ViewingStatus, string> = {
  scheduled: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-emerald-100 text-emerald-800',
  completed: 'bg-slate-100 text-slate-700',
  no_show: 'bg-red-100 text-red-800',
  cancelled: 'bg-slate-100 text-slate-500',
}

export type ViewingRow = {
  id: string
  lead_id: string | null
  deal_id: string | null
  property_id: string
  agent_id: string
  scheduled_at: string
  status: ViewingStatus
  client_name: string | null
  client_phone: string | null
  feedback: string | null
  interest_level: ViewingInterestLevel | null
  created_at: string
  updated_at: string
  leads?: { id: string; name: string; phone: string | null } | null
  deals?: { id: string; client_name: string | null; stage: string } | null
  properties?: { id: string; address: string | null; city: string | null; state: string | null } | null
  agents?: { id: string; full_name: string | null } | null
}

export type UpcomingViewings = {
  from: string
  to: string
  today_count: number
  viewings: ViewingRow[]
}

export function viewingDisplayName(v: ViewingRow): string {
  return v.leads?.name?.trim() || v.client_name?.trim() || 'Client'
}

export function viewingPropertyLabel(v: ViewingRow): string {
  const p = v.properties
  if (!p) return 'Property'
  return [p.address, p.city, p.state].filter(Boolean).join(', ') || 'Property'
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${WEBHOOK_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(json.error || `Request failed (${res.status})`)
  }
  return json as T
}

export async function fetchViewings(params?: {
  agent_id?: string
  status?: ViewingStatus
  property_id?: string
  lead_id?: string
  from?: string
  to?: string
}): Promise<ViewingRow[]> {
  const q = new URLSearchParams()
  if (params?.agent_id) q.set('agent_id', params.agent_id)
  if (params?.status) q.set('status', params.status)
  if (params?.property_id) q.set('property_id', params.property_id)
  if (params?.lead_id) q.set('lead_id', params.lead_id)
  if (params?.from) q.set('from', params.from)
  if (params?.to) q.set('to', params.to)
  const suffix = q.toString()
  const data = await apiFetch<{ viewings: ViewingRow[] }>(
    `/api/viewings${suffix ? `?${suffix}` : ''}`
  )
  return data.viewings
}

export async function fetchUpcomingViewings(agentId?: string): Promise<UpcomingViewings> {
  const q = agentId ? `?agent_id=${encodeURIComponent(agentId)}` : ''
  return apiFetch<UpcomingViewings>(`/api/viewings/upcoming${q}`)
}

export async function createViewing(payload: Record<string, unknown>): Promise<ViewingRow> {
  const data = await apiFetch<{ viewing: ViewingRow }>('/api/viewings', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data.viewing
}

export async function updateViewing(
  id: string,
  payload: Record<string, unknown>
): Promise<ViewingRow> {
  const data = await apiFetch<{ viewing: ViewingRow }>(`/api/viewings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return data.viewing
}
