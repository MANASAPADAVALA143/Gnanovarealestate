import { supabase } from './supabase'
import { webhookBaseUrlFromEnv } from './deals'

const WEBHOOK_BASE = webhookBaseUrlFromEnv()

export type PaymentPlanMilestone = {
  id: string
  property_id: string
  milestone: string
  percentage: number
  due_date: string | null
  notes: string | null
  sort_order: number
  created_at: string
}

export type MilestoneInput = {
  milestone: string
  percentage: number
  due_date?: string | null
  notes?: string | null
  sort_order?: number
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

export function getPaymentPlan(propertyId: string) {
  return apiFetch<{ milestones: PaymentPlanMilestone[] }>(
    `/api/properties/${propertyId}/payment-plan`
  )
}

export function addMilestone(propertyId: string, data: MilestoneInput) {
  return apiFetch<{ milestone: PaymentPlanMilestone }>(
    `/api/properties/${propertyId}/payment-plan`,
    { method: 'POST', body: JSON.stringify(data) }
  )
}

export function updateMilestone(propertyId: string, id: string, data: Partial<MilestoneInput>) {
  return apiFetch<{ milestone: PaymentPlanMilestone }>(
    `/api/properties/${propertyId}/payment-plan/${id}`,
    { method: 'PUT', body: JSON.stringify(data) }
  )
}

export function deleteMilestone(propertyId: string, id: string) {
  return apiFetch<{ success: boolean }>(`/api/properties/${propertyId}/payment-plan/${id}`, {
    method: 'DELETE',
  })
}

export function fetchPaymentPlanTeasers(propertyIds: string[]) {
  if (propertyIds.length === 0) return Promise.resolve({ teasers: {} as Record<string, string> })
  const q = encodeURIComponent(propertyIds.join(','))
  return apiFetch<{ teasers: Record<string, string> }>(
    `/api/properties/payment-plan-teasers?propertyIds=${q}`
  )
}

/** Format AED for payment plan table (full or compact K/M). */
export function formatPlanAmount(aed: number, compact = false): string {
  if (!Number.isFinite(aed)) return 'AED —'
  if (!compact) return `AED ${Math.round(aed).toLocaleString()}`
  const abs = Math.abs(aed)
  if (abs >= 1_000_000) return `AED ${(aed / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`
  if (abs >= 1_000) return `AED ${Math.round(aed / 1_000)}K`
  return `AED ${Math.round(aed).toLocaleString()}`
}

export const BAR_COLORS = ['#7C3AED', '#06B6D4', '#10B981', '#F59E0B'] as const

export const QUICK_MILESTONES = [
  'On Booking',
  'On Handover',
  '30% Construction',
  '50% Completion',
] as const
