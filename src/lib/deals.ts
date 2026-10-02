import { supabase } from './supabase'

// Keep for any remaining consumers that imported this helper
export function webhookBaseUrlFromEnv(): string {
  if (typeof import.meta !== 'undefined') {
    const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env
    const fromEnv = env?.VITE_WEBHOOK_URL?.replace(/\/$/, '')
    if (fromEnv) return fromEnv
  }
  return 'http://localhost:3001'
}

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

export async function fetchDeals(agentId?: string | null): Promise<DealRow[]> {
  let q = supabase
    .from('deals')
    .select('*, leads(name, phone), agents(full_name)')
    .order('updated_at', { ascending: false })

  if (agentId) q = q.eq('agent_id', agentId) as typeof q

  const { data, error } = await q
  if (error) throw error
  return (data || []) as DealRow[]
}

export async function fetchDeal(id: string): Promise<{ deal: DealRow; activities: DealActivity[] }> {
  const [dealRes, activitiesRes] = await Promise.all([
    supabase
      .from('deals')
      .select('*, leads(name, phone), agents(full_name)')
      .eq('id', id)
      .single(),
    supabase
      .from('deal_activities')
      .select('*')
      .eq('deal_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (dealRes.error) throw dealRes.error
  return {
    deal: dealRes.data as DealRow,
    activities: (activitiesRes.data || []) as DealActivity[],
  }
}

export async function createDeal(payload: Record<string, unknown>): Promise<DealRow> {
  const { data, error } = await supabase
    .from('deals')
    .insert(payload as never)
    .select('*, leads(name, phone), agents(full_name)')
    .single()

  if (error) throw error
  return data as DealRow
}

export async function updateDeal(
  id: string,
  payload: Record<string, unknown>
): Promise<DealRow> {
  const { data, error } = await supabase
    .from('deals')
    .update({ ...payload, updated_at: new Date().toISOString() } as never)
    .eq('id', id)
    .select('*, leads(name, phone), agents(full_name)')
    .single()

  if (error) throw error
  return data as DealRow
}

export async function fetchDealsSummary(): Promise<DealsSummary> {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

  const { data: deals, error } = await supabase
    .from('deals')
    .select('sale_value, agent_commission, stage, agent_id, agents(full_name)')
    .gte('created_at', monthStart)
    .lte('created_at', monthEnd)

  if (error) throw error

  const rows = (deals || []) as Array<{
    sale_value: number | null
    agent_commission: number | null
    stage: string
    agent_id: string | null
    agents: { full_name: string | null } | null
  }>

  const totalSales = rows.filter(d => d.stage === 'closed_won').reduce((s, d) => s + (d.sale_value || 0), 0)
  const commissionEarned = rows.filter(d => d.stage === 'closed_won').reduce((s, d) => s + (d.agent_commission || 0), 0)
  const commissionPending = rows.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost').reduce((s, d) => s + (d.agent_commission || 0), 0)

  const agentMap = new Map<string, { full_name: string | null; sale_value: number }>()
  for (const d of rows.filter(r => r.stage === 'closed_won' && r.agent_id)) {
    const existing = agentMap.get(d.agent_id!)
    if (existing) existing.sale_value += d.sale_value || 0
    else agentMap.set(d.agent_id!, { full_name: d.agents?.full_name ?? null, sale_value: d.sale_value || 0 })
  }

  return {
    month_start: monthStart,
    month_end: monthEnd,
    total_sales: totalSales,
    commission_earned: commissionEarned,
    commission_pending: commissionPending,
    deals_won: rows.filter(d => d.stage === 'closed_won').length,
    deals_lost: rows.filter(d => d.stage === 'closed_lost').length,
    top_agents: Array.from(agentMap.entries())
      .map(([agent_id, v]) => ({ agent_id, ...v }))
      .sort((a, b) => b.sale_value - a.sale_value)
      .slice(0, 5),
  }
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
  const { error } = await supabase.from('deal_activities').insert({
    deal_id: dealId,
    activity_type: 'note',
    description: note,
    created_by: agentId ?? null,
  } as never)
  if (error) throw error
}
