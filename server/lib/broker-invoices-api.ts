import type { Request, Response } from 'express'
import type { SupabaseClient } from '@supabase/supabase-js'

export const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'overdue', 'partial'] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

function isInvoiceStatus(v: string): v is InvoiceStatus {
  return (INVOICE_STATUSES as readonly string[]).includes(v)
}

function nextInvoiceNumber(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `INV-${y}${m}-${rand}`
}

function dueDatePlusDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Create invoice for an approved commission (deal), idempotent on commission_id.
 * Does not modify deals.commission_status.
 */
export async function ensureInvoiceForCommission(
  supabase: SupabaseClient,
  commissionId: string
): Promise<{ invoice: Record<string, unknown>; created: boolean }> {
  const { data: existing } = await supabase
    .from('broker_invoices')
    .select('*')
    .eq('commission_id', commissionId)
    .maybeSingle()

  if (existing) {
    return { invoice: existing as Record<string, unknown>, created: false }
  }

  const { data: deal, error: dealErr } = await supabase
    .from('deals')
    .select(
      'id, agent_id, agent_commission, brokerage_commission, commission_status, project_name, unit_number, client_name'
    )
    .eq('id', commissionId)
    .maybeSingle()

  if (dealErr || !deal) {
    throw new Error(dealErr?.message || 'Commission/deal not found')
  }

  const status = (deal as { commission_status?: string }).commission_status
  if (status !== 'approved' && status !== 'paid') {
    throw new Error('Invoice can only be generated when commission is approved (payable) or paid')
  }

  const brokerId = (deal as { agent_id: string | null }).agent_id
  if (!brokerId) {
    throw new Error('Deal has no agent (broker) assigned')
  }

  const agentAmt = Number((deal as { agent_commission?: number | null }).agent_commission ?? 0)
  const brokerageAmt = Number(
    (deal as { brokerage_commission?: number | null }).brokerage_commission ?? 0
  )
  const amount = agentAmt > 0 ? agentAmt : brokerageAmt

  const row = {
    broker_id: brokerId,
    commission_id: commissionId,
    invoice_number: nextInvoiceNumber(),
    amount,
    status: 'draft' as const,
    payment_method: null,
    emi_plan: false,
    amount_paid: 0,
    due_date: dueDatePlusDays(30),
    paid_at: null,
    pdf_url: null,
    notes: null,
  }

  const { data: inserted, error: insErr } = await supabase
    .from('broker_invoices')
    .insert(row)
    .select('*')
    .single()

  if (insErr || !inserted) {
    // Race: unique on commission_id
    const { data: again } = await supabase
      .from('broker_invoices')
      .select('*')
      .eq('commission_id', commissionId)
      .maybeSingle()
    if (again) return { invoice: again as Record<string, unknown>, created: false }
    throw new Error(insErr?.message || 'Failed to create invoice')
  }

  return { invoice: inserted as Record<string, unknown>, created: true }
}

export async function listBrokerInvoicesHandler(
  supabase: SupabaseClient,
  req: Request,
  res: Response
): Promise<void> {
  const brokerId = typeof req.query.broker_id === 'string' ? req.query.broker_id : ''
  const status = typeof req.query.status === 'string' ? req.query.status : ''

  let q = supabase
    .from('broker_invoices')
    .select(
      `
      *,
      agents:broker_id ( id, full_name, email, company_name ),
      deals:commission_id ( id, project_name, unit_number, client_name, commission_status )
    `
    )
    .order('created_at', { ascending: false })

  if (brokerId) q = q.eq('broker_id', brokerId)
  if (status && isInvoiceStatus(status)) q = q.eq('status', status)

  const { data, error } = await q
  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  res.json({ invoices: data || [] })
}

export async function createBrokerInvoiceHandler(
  supabase: SupabaseClient,
  req: Request,
  res: Response
): Promise<void> {
  try {
    const commissionId =
      typeof req.body?.commission_id === 'string' ? req.body.commission_id.trim() : ''
    if (!commissionId) {
      res.status(400).json({ error: 'commission_id is required' })
      return
    }
    const result = await ensureInvoiceForCommission(supabase, commissionId)
    res.status(result.created ? 201 : 200).json(result)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Create invoice failed'
    res.status(400).json({ error: msg })
  }
}

export async function updateBrokerInvoiceHandler(
  supabase: SupabaseClient,
  req: Request,
  res: Response
): Promise<void> {
  const id = req.params.id
  if (!id) {
    res.status(400).json({ error: 'id required' })
    return
  }

  const body = (req.body || {}) as Record<string, unknown>
  const patch: Record<string, unknown> = {}

  if (typeof body.status === 'string') {
    if (!isInvoiceStatus(body.status)) {
      res.status(400).json({ error: 'Invalid status' })
      return
    }
    patch.status = body.status
    if (body.status === 'paid') {
      patch.paid_at = new Date().toISOString()
      if (body.amount_paid == null) {
        const { data: cur } = await supabase
          .from('broker_invoices')
          .select('amount')
          .eq('id', id)
          .maybeSingle()
        if (cur) patch.amount_paid = (cur as { amount: number }).amount
      }
    }
  }

  if (typeof body.payment_method === 'string' || body.payment_method === null) {
    patch.payment_method = body.payment_method
  }
  if (typeof body.emi_plan === 'boolean') patch.emi_plan = body.emi_plan
  if (typeof body.amount_paid === 'number') patch.amount_paid = body.amount_paid
  if (typeof body.due_date === 'string' || body.due_date === null) patch.due_date = body.due_date
  if (typeof body.pdf_url === 'string' || body.pdf_url === null) patch.pdf_url = body.pdf_url
  if (typeof body.notes === 'string' || body.notes === null) patch.notes = body.notes

  // Partial EMI payment
  if (body.mark_partial === true) {
    const paid = typeof body.amount_paid === 'number' ? body.amount_paid : Number(body.amount_paid)
    if (!Number.isFinite(paid) || paid < 0) {
      res.status(400).json({ error: 'amount_paid required for partial payment' })
      return
    }
    patch.amount_paid = paid
    patch.emi_plan = true
    patch.status = 'partial'
    patch.payment_method =
      typeof body.payment_method === 'string' ? body.payment_method : 'emi'
  }

  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: 'No fields to update' })
    return
  }

  const { data, error } = await supabase
    .from('broker_invoices')
    .update(patch)
    .eq('id', id)
    .select(
      `
      *,
      agents:broker_id ( id, full_name, email, company_name ),
      deals:commission_id ( id, project_name, unit_number, client_name, commission_status )
    `
    )
    .maybeSingle()

  if (error) {
    res.status(400).json({ error: error.message })
    return
  }
  if (!data) {
    res.status(404).json({ error: 'Invoice not found' })
    return
  }
  res.json({ invoice: data })
}

export async function brokerPaymentStatusHandler(
  supabase: SupabaseClient,
  req: Request,
  res: Response
): Promise<void> {
  const brokerId = typeof req.query.broker_id === 'string' ? req.query.broker_id : ''
  if (!brokerId) {
    res.status(400).json({ error: 'broker_id required' })
    return
  }

  const { data, error } = await supabase
    .from('broker_invoices')
    .select('id, amount, amount_paid, status, emi_plan, due_date, invoice_number')
    .eq('broker_id', brokerId)
    .order('created_at', { ascending: false })

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  const invoices = data || []
  const open = invoices.filter((i) => !['paid'].includes(i.status as string))
  const totalDue = open.reduce((s, i) => s + Number(i.amount || 0) - Number(i.amount_paid || 0), 0)
  const hasEmi = open.some((i) => i.emi_plan)
  const paidCount = invoices.filter((i) => i.status === 'paid').length

  res.json({
    broker_id: brokerId,
    payment_mode: hasEmi ? 'emi' : 'full',
    total_outstanding: totalDue,
    open_count: open.length,
    paid_count: paidCount,
    invoices: invoices.slice(0, 10),
  })
}
