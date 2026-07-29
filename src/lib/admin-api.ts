import { supabase } from './supabase'

function nextAppOrigin(): string {
  return (
    (typeof import.meta !== 'undefined' &&
      import.meta.env?.VITE_NEXT_APP_URL?.replace(/\/$/, '')) ||
    'http://localhost:3002'
  )
}

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${nextAppOrigin()}${path}`, {
    ...init,
    headers: {
      ...(await authHeaders()),
      ...init?.headers,
    },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((json as { error?: string }).error || `Request failed (${res.status})`)
  }
  return json as T
}

export type AdminOverview = {
  total_paid_revenue: number
  revenue_by_broker: Array<{
    broker_id: string
    broker_name: string
    paid_total: number
    pending_total: number
  }>
  deals_closed_this_month: number
  deals_closed_last_month: number
  commission_pipeline: {
    pending_total: number
    approved_total: number
  }
  viewer: { agent_id: string; is_owner: boolean }
}

export type AdminBroker = {
  id: string
  full_name: string | null
  email: string | null
  is_available: boolean
  is_manager: boolean
  is_owner: boolean
  broker_rank_score: number
  rank_factors: Record<string, unknown>
  rank_updated_at: string | null
  active_lead_count: number
  deals_closed_90d: number
  last_active: string | null
}

export type AdminAuditEntry = {
  id: string
  action: string
  performed_by: string
  performed_by_name: string
  target_agent_id: string | null
  target_agent_name: string | null
  old_value: Record<string, unknown>
  new_value: Record<string, unknown>
  created_at: string
}

export function fetchAdminOverview() {
  return adminFetch<AdminOverview>('/api/admin/overview')
}

export function fetchAdminBrokers() {
  return adminFetch<{ brokers: AdminBroker[]; viewer: { agent_id: string; is_owner: boolean } }>(
    '/api/admin/brokers'
  )
}

export function fetchAdminAuditLog() {
  return adminFetch<{ entries: AdminAuditEntry[] }>('/api/admin/audit-log')
}

export function startRankRecalculation() {
  return adminFetch<{ ok: boolean; message: string }>('/api/admin/recalculate-ranks', {
    method: 'POST',
  })
}

export function patchAdminBroker(
  id: string,
  body: { broker_rank_score?: number; is_available?: boolean; is_manager?: boolean }
) {
  return adminFetch<{ broker: AdminBroker; action: string }>(`/api/admin/brokers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}
