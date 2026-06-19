function webhookBaseUrl(): string {
  if (typeof import.meta !== 'undefined') {
    const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env
    const fromEnv = env?.VITE_WEBHOOK_URL?.replace(/\/$/, '')
    if (fromEnv) return fromEnv
  }
  return 'http://localhost:3001'
}

export function webhookBaseUrlFromEnv(): string {
  return webhookBaseUrl()
}

const WEBHOOK_BASE = webhookBaseUrl()

export const DEAL_STAGES = [
  'viewing',
  'offer',
  'booking',
  'mou_signed',
  'spa_signed',
  'closed_won',
  'closed_lost',
] as const

export type DealStage = (typeof DEAL_STAGES)[number]

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  viewing: 'Viewing',
  offer: 'Offer',
  booking: 'Booking',
  mou_signed: 'MOU Signed',
  spa_signed: 'SPA Signed',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
}

export type DealRow = {
  id: string
  lead_id: string | null
  agent_id: string | null
  client_name: string | null
  stage: DealStage
  unit_number: string | null
  project_name: string | null
  booking_amount: number | null
  token_amount: number | null
  sale_value: number | null
  commission_percent: number | null
  agent_commission: number | null
  brokerage_commission: number | null
  developer_incentive: number | null
  lost_reason: string | null
  expected_close_date: string | null
  actual_close_date: string | null
  stage_entered_at: string
  created_at: string
  updated_at: string
  commission_status?: 'pending' | 'submitted' | 'approved' | 'paid'
  commission_submitted_at?: string | null
  commission_approved_at?: string | null
  commission_paid_at?: string | null
  commission_payment_reference?: string | null
  leads?: { name: string; phone: string } | null
  agents?: { full_name: string | null } | null
}

export type DealActivity = {
  id: string
  deal_id: string
  activity_type:
    | 'stage_change'
    | 'note'
    | 'amount_update'
    | 'document'
    | 'system'
    | 'commission_status_change'
  description: string
  created_at: string
  created_by: string | null
}

export type DealsSummary = {
  month_start: string
  month_end: string
  total_sales: number
  commission_earned: number
  commission_pending: number
  deals_won: number
  deals_lost: number
  top_agents: Array<{ agent_id: string; full_name: string | null; sale_value: number }>
}

export function dealDisplayName(deal: DealRow): string {
  return deal.leads?.name || deal.client_name || 'Unknown client'
}

export function formatAed(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return '—'
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    maximumFractionDigits: 0,
  }).format(amount)
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

export async function fetchDeals(agentId?: string | null): Promise<DealRow[]> {
  const params = new URLSearchParams()
  if (agentId) params.set('agent_id', agentId)
  const q = params.toString()
  const data = await apiFetch<{ deals: DealRow[] }>(`/api/deals${q ? `?${q}` : ''}`)
  return data.deals
}

export async function fetchDeal(id: string): Promise<{ deal: DealRow; activities: DealActivity[] }> {
  return apiFetch(`/api/deals/${id}`)
}

export async function createDeal(payload: Record<string, unknown>): Promise<DealRow> {
  const data = await apiFetch<{ deal: DealRow }>('/api/deals', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data.deal
}

export async function updateDeal(
  id: string,
  payload: Record<string, unknown>
): Promise<DealRow> {
  const data = await apiFetch<{ deal: DealRow }>(`/api/deals/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return data.deal
}

export async function fetchDealsSummary(): Promise<DealsSummary> {
  return apiFetch<DealsSummary>('/api/deals/summary')
}

export async function fetchDealActivities(dealId: string): Promise<DealActivity[]> {
  const { activities } = await fetchDeal(dealId)
  return activities
}

export async function addDealNote(
  dealId: string,
  note: string,
  agentId?: string | null
): Promise<void> {
  await updateDeal(dealId, { note, updated_by: agentId ?? null })
}
