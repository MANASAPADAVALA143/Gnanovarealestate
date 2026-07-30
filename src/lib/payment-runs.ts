import { supabase } from './supabase'
import { webhookBaseUrlFromEnv, formatAed } from './deals'

const WEBHOOK_BASE = webhookBaseUrlFromEnv()

export const PAYMENT_METHOD_OPTIONS = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'cash', label: 'Cash' },
  { value: 'online', label: 'Online' },
] as const

export type OpenInvoiceForRun = {
  id: string
  broker_id: string
  invoice_number: string
  amount: number
  amount_paid: number
  status: string
  due_date: string | null
  outstanding_aed: number
  days_overdue: number
  agents?: { id: string; full_name: string | null; email: string | null } | null
  deals?: {
    id: string
    project_name: string | null
    unit_number: string | null
    client_name: string | null
  } | null
}

export type PaymentRunListItem = {
  id: string
  run_date: string
  payment_method: string
  payment_reference: string
  total_amount_aed: number
  invoice_count: number
  notes: string | null
  created_at: string
  created_by_agent?: { id: string; full_name: string | null } | null
  payment_run_items?: Array<{
    id: string
    amount_aed: number
    invoice_id: string
    broker_agent_id: string | null
    broker_invoices?: { id: string; invoice_number: string } | null
    agents?: { id: string; full_name: string | null } | null
  }>
}

export type PaymentRunDetail = PaymentRunListItem & {
  payment_run_items?: Array<{
    id: string
    amount_aed: number
    invoice_id: string
    broker_agent_id: string | null
    broker_invoices?: {
      id: string
      invoice_number: string
      amount?: number
      deals?: {
        project_name: string | null
        unit_number: string | null
        client_name: string | null
      } | null
    } | null
    agents?: { id: string; full_name: string | null; email?: string | null } | null
  }>
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

export function fetchOpenInvoicesForPaymentRun() {
  return apiFetch<{ invoices: OpenInvoiceForRun[] }>('/api/payment-runs/open-invoices')
}

export function fetchPaymentRuns() {
  return apiFetch<{ runs: PaymentRunListItem[] }>('/api/payment-runs')
}

export function fetchPaymentRun(id: string) {
  return apiFetch<{ run: PaymentRunDetail }>(`/api/payment-runs/${id}`)
}

export function createPaymentRun(body: {
  invoice_ids: string[]
  payment_method: string
  payment_reference: string
  run_date: string
  notes?: string
}) {
  return apiFetch<{
    run_id: string
    total_amount_aed: number
    invoice_count: number
    payment_reference: string
    payment_method: string
    run_date: string
  }>('/api/payment-runs', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function paymentMethodLabel(method: string): string {
  return PAYMENT_METHOD_OPTIONS.find((o) => o.value === method)?.label || method
}

export function dealLabelFromInvoice(inv: OpenInvoiceForRun): string {
  return (
    [inv.deals?.project_name, inv.deals?.unit_number].filter(Boolean).join(' · ') ||
    inv.deals?.client_name ||
    '—'
  )
}

export { formatAed }
