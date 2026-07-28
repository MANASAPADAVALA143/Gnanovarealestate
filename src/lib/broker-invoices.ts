import { webhookBaseUrlFromEnv, formatAed } from './deals'

const WEBHOOK_BASE = webhookBaseUrlFromEnv()

export const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'overdue', 'partial'] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  overdue: 'Overdue',
  partial: 'Partial (EMI)',
}

export const INVOICE_STATUS_BADGE: Record<InvoiceStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  sent: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
  partial: 'bg-amber-100 text-amber-900',
}

export type BrokerInvoice = {
  id: string
  broker_id: string
  commission_id: string
  invoice_number: string
  amount: number
  status: InvoiceStatus
  payment_method: string | null
  emi_plan: boolean
  amount_paid: number
  due_date: string | null
  paid_at: string | null
  pdf_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
  agents?: {
    id: string
    full_name: string | null
    email: string | null
    company_name: string | null
  } | null
  deals?: {
    id: string
    project_name: string | null
    unit_number: string | null
    client_name: string | null
    commission_status: string | null
  } | null
}

/** "Project · Unit" label for an invoice's deal. */
export function invoiceDealLabel(inv: BrokerInvoice): string {
  return (
    [inv.deals?.project_name, inv.deals?.unit_number].filter(Boolean).join(' · ') || '—'
  )
}

export type BrokerPaymentStatus = {
  broker_id: string
  payment_mode: 'full' | 'emi'
  total_outstanding: number
  open_count: number
  paid_count: number
  invoices: Array<{
    id: string
    amount: number
    amount_paid: number
    status: string
    emi_plan: boolean
    due_date: string | null
    invoice_number: string
  }>
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${WEBHOOK_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((json as { error?: string }).error || `Request failed (${res.status})`)
  }
  return json as T
}

export async function fetchBrokerInvoices(params?: {
  broker_id?: string
  status?: InvoiceStatus
}): Promise<BrokerInvoice[]> {
  const q = new URLSearchParams()
  if (params?.broker_id) q.set('broker_id', params.broker_id)
  if (params?.status) q.set('status', params.status)
  const qs = q.toString()
  const data = await apiFetch<{ invoices: BrokerInvoice[] }>(
    `/api/broker-invoices${qs ? `?${qs}` : ''}`
  )
  return data.invoices
}

export async function ensureBrokerInvoice(commissionId: string): Promise<{
  invoice: BrokerInvoice
  created: boolean
}> {
  return apiFetch('/api/broker-invoices', {
    method: 'POST',
    body: JSON.stringify({ commission_id: commissionId }),
  })
}

export async function updateBrokerInvoice(
  id: string,
  payload: Record<string, unknown>
): Promise<BrokerInvoice> {
  const data = await apiFetch<{ invoice: BrokerInvoice }>(`/api/broker-invoices/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return data.invoice
}

export async function markInvoicePaid(
  id: string,
  paymentMethod = 'bank_transfer'
): Promise<BrokerInvoice> {
  return updateBrokerInvoice(id, { status: 'paid', payment_method: paymentMethod })
}

export async function markInvoicePartialEmi(
  id: string,
  amountPaid: number,
  paymentMethod = 'emi'
): Promise<BrokerInvoice> {
  return updateBrokerInvoice(id, {
    mark_partial: true,
    amount_paid: amountPaid,
    payment_method: paymentMethod,
  })
}

export async function fetchBrokerPaymentStatus(brokerId: string): Promise<BrokerPaymentStatus> {
  return apiFetch(`/api/broker-invoices/payment-status?broker_id=${encodeURIComponent(brokerId)}`)
}

export { formatAed }
