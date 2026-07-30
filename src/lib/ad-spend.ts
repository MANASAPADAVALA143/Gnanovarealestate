import { supabase } from './supabase'
import { webhookBaseUrlFromEnv, formatAed } from './deals'

const WEBHOOK_BASE = webhookBaseUrlFromEnv()

export const AD_SPEND_SOURCE_OPTIONS = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'meta_ads', label: 'Meta Ads' },
  { value: 'property_finder', label: 'Property Finder' },
  { value: 'bayut', label: 'Bayut' },
  { value: 'website', label: 'Website' },
  { value: 'referral', label: 'Referral' },
  { value: 'walk_in', label: 'Walk-in' },
] as const

export type AdSpendEntry = {
  id: string
  period_start: string
  period_end: string
  source: string
  campaign_name: string | null
  spend_aed: number
  created_by: string | null
  created_at: string
  updated_at: string
  lead_count: number
  cost_per_lead: number | null
}

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${WEBHOOK_BASE}${path}`, {
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

export function fetchAdSpendEntries() {
  return apiFetch<{ entries: AdSpendEntry[] }>('/api/ad-spend')
}

export function createAdSpendEntry(body: {
  period_start: string
  period_end: string
  source: string
  campaign_name?: string
  spend_aed: number
}) {
  return apiFetch<{ entry: AdSpendEntry }>('/api/ad-spend', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function updateAdSpendEntry(
  id: string,
  body: { spend_aed?: number; campaign_name?: string | null }
) {
  return apiFetch<{ entry: AdSpendEntry }>(`/api/ad-spend/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export function deleteAdSpendEntry(id: string) {
  return apiFetch<{ ok: boolean }>(`/api/ad-spend/${id}`, { method: 'DELETE' })
}

export function cplBadgeClass(cpl: number | null): string {
  if (cpl == null) return 'bg-red-100 text-red-800'
  if (cpl < 500) return 'bg-emerald-100 text-emerald-800'
  if (cpl <= 1500) return 'bg-amber-100 text-amber-900'
  return 'bg-red-100 text-red-800'
}

export function sourceLabel(source: string): string {
  return AD_SPEND_SOURCE_OPTIONS.find((o) => o.value === source)?.label || source
}

export { formatAed }
