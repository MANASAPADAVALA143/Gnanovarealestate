import { webhookBaseUrlFromEnv, formatAed, type DealRow } from './deals'

const WEBHOOK_BASE = webhookBaseUrlFromEnv()

export const COMMISSION_STATUSES = ['pending', 'submitted', 'approved', 'paid'] as const
export type CommissionStatus = (typeof COMMISSION_STATUSES)[number]

export const COMMISSION_STATUS_LABELS: Record<CommissionStatus, string> = {
  pending: 'Pending',
  submitted: 'Submitted',
  approved: 'Approved',
  paid: 'Paid',
}

export const COMMISSION_STATUS_BADGE: Record<CommissionStatus, string> = {
  pending: 'bg-slate-100 text-slate-700',
  submitted: 'bg-blue-100 text-blue-800',
  approved: 'bg-amber-100 text-amber-900',
  paid: 'bg-green-100 text-green-800',
}

export type CommissionRow = DealRow & {
  commission_status: CommissionStatus
  commission_submitted_at: string | null
  commission_approved_at: string | null
  commission_paid_at: string | null
  commission_payment_reference: string | null
  status_changed_at?: string | null
}

export type CommissionsSummary = {
  month_start: string
  month_end: string
  all_time: {
    total_pending: number
    total_approved: number
    total_paid: number
  }
  this_month: {
    total_pending: number
    total_approved: number
    total_paid: number
  }
  by_agent: Array<{
    agent_id: string
    full_name: string | null
    pending: number
    approved: number
    paid: number
  }>
}

export function commissionNextStatus(current: CommissionStatus): CommissionStatus | null {
  switch (current) {
    case 'pending':
      return 'submitted'
    case 'submitted':
      return 'approved'
    case 'approved':
      return 'paid'
    default:
      return null
  }
}

export function commissionStatusChangedAt(row: CommissionRow): string | null {
  if (row.status_changed_at) return row.status_changed_at
  switch (row.commission_status) {
    case 'paid':
      return row.commission_paid_at
    case 'approved':
      return row.commission_approved_at
    case 'submitted':
      return row.commission_submitted_at
    default:
      return row.updated_at
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${WEBHOOK_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(json.error || `Request failed (${res.status})`) as Error & {
      code?: string
      can_override?: boolean
    }
    err.code = json.code
    err.can_override = json.can_override
    throw err
  }
  return json as T
}

export async function fetchCommissions(params?: {
  agent_id?: string
  status?: CommissionStatus
  from?: string
  to?: string
}): Promise<CommissionRow[]> {
  const q = new URLSearchParams()
  if (params?.agent_id) q.set('agent_id', params.agent_id)
  if (params?.status) q.set('status', params.status)
  if (params?.from) q.set('from', params.from)
  if (params?.to) q.set('to', params.to)
  const qs = q.toString()
  const data = await apiFetch<{ commissions: CommissionRow[] }>(
    `/api/commissions${qs ? `?${qs}` : ''}`
  )
  return data.commissions
}

export async function fetchCommissionsSummary(): Promise<CommissionsSummary> {
  return apiFetch<CommissionsSummary>('/api/commissions/summary')
}

export async function updateCommissionStatus(
  dealId: string,
  payload: {
    commission_status: CommissionStatus
    commission_payment_reference?: string | null
    allow_missing_payment_reference?: boolean
    updated_by?: string | null
  }
): Promise<{ deal: CommissionRow; warnings?: string[] }> {
  return apiFetch(`/api/deals/${dealId}/commission`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function bulkSubmitCommissions(
  dealIds: string[],
  managerId: string
): Promise<{ succeeded: number; failed: number; results: Array<{ id: string; ok: boolean; error?: string }> }> {
  return apiFetch('/api/commissions/bulk-submit', {
    method: 'POST',
    body: JSON.stringify({ deal_ids: dealIds, manager_id: managerId }),
  })
}

export { formatAed }
