import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Request, Response } from 'express'

export const PAYMENT_METHODS = ['bank_transfer', 'cheque', 'cash', 'online'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

/** Open invoice statuses eligible for a payment run (028 schema — not "unpaid"). */
const OPEN_STATUSES = new Set(['draft', 'sent', 'overdue', 'partial'])

function isPaymentMethod(v: string): v is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(v)
}

function outstanding(inv: { amount?: number | string | null; amount_paid?: number | string | null }): number {
  const amount = Number(inv.amount) || 0
  const paid = Number(inv.amount_paid) || 0
  return Math.max(0, Math.round((amount - paid) * 100) / 100)
}

function supabaseAnonUrlKey(): { url: string; key: string } | null {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL
  )?.trim()
  const key = (
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim()
  if (!url || !key) return null
  return { url, key }
}

async function resolveManager(
  req: Request,
  service: SupabaseClient
): Promise<{ agentId: string; fullName: string | null } | null> {
  const header = (req.headers.authorization || req.headers.Authorization) as string | undefined
  const match = header?.match(/^Bearer\s+(.+)$/i)
  const token = match?.[1]?.trim()
  if (!token) return null

  const cfg = supabaseAnonUrlKey()
  if (!cfg) return null

  const anon = createClient(cfg.url, cfg.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await anon.auth.getUser(token)
  if (error || !data.user?.id) return null

  const { data: agent } = await service
    .from('agents')
    .select('id, full_name, is_manager, is_owner')
    .eq('id', data.user.id)
    .maybeSingle()

  if (!agent) return null
  const row = agent as {
    id: string
    full_name: string | null
    is_manager?: boolean
    is_owner?: boolean
  }
  if (!row.is_manager && !row.is_owner) return null
  return { agentId: row.id, fullName: row.full_name }
}

export async function listPaymentRunsHandler(
  supabase: SupabaseClient,
  req: Request,
  res: Response
): Promise<void> {
  const caller = await resolveManager(req, supabase)
  if (!caller) {
    res.status(401).json({ error: 'Unauthorized — manager/owner required' })
    return
  }

  const { data, error } = await supabase
    .from('payment_runs')
    .select(
      `
      *,
      created_by_agent:created_by ( id, full_name ),
      payment_run_items (
        id,
        amount_aed,
        invoice_id,
        broker_agent_id,
        broker_invoices:invoice_id ( id, invoice_number ),
        agents:broker_agent_id ( id, full_name )
      )
    `
    )
    .order('run_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  res.json({ runs: data || [] })
}

export async function getPaymentRunHandler(
  supabase: SupabaseClient,
  req: Request,
  res: Response
): Promise<void> {
  const caller = await resolveManager(req, supabase)
  if (!caller) {
    res.status(401).json({ error: 'Unauthorized — manager/owner required' })
    return
  }

  const id = req.params.id
  if (!id) {
    res.status(400).json({ error: 'Missing id' })
    return
  }

  const { data, error } = await supabase
    .from('payment_runs')
    .select(
      `
      *,
      created_by_agent:created_by ( id, full_name ),
      payment_run_items (
        id,
        amount_aed,
        invoice_id,
        broker_agent_id,
        broker_invoices:invoice_id (
          id,
          invoice_number,
          amount,
          amount_paid,
          deals:commission_id ( id, project_name, unit_number, client_name )
        ),
        agents:broker_agent_id ( id, full_name, email )
      )
    `
    )
    .eq('id', id)
    .maybeSingle()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  if (!data) {
    res.status(404).json({ error: 'Payment run not found' })
    return
  }

  res.json({ run: data })
}

export async function createPaymentRunHandler(
  supabase: SupabaseClient,
  req: Request,
  res: Response
): Promise<void> {
  const caller = await resolveManager(req, supabase)
  if (!caller) {
    res.status(401).json({ error: 'Unauthorized — manager/owner required' })
    return
  }

  const body = req.body || {}
  const invoiceIds = Array.isArray(body.invoice_ids)
    ? (body.invoice_ids as unknown[]).map(String).filter(Boolean)
    : []
  const payment_method = String(body.payment_method || '').trim()
  const payment_reference = String(body.payment_reference || '').trim()
  const run_date = String(body.run_date || new Date().toISOString().slice(0, 10)).slice(0, 10)
  const notes =
    typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null

  if (invoiceIds.length === 0) {
    res.status(400).json({ error: 'invoice_ids required' })
    return
  }
  if (!isPaymentMethod(payment_method)) {
    res.status(400).json({
      error: `payment_method must be one of: ${PAYMENT_METHODS.join(', ')}`,
    })
    return
  }
  if (!payment_reference) {
    res.status(400).json({ error: 'payment_reference required' })
    return
  }

  const { data: invoices, error: invErr } = await supabase
    .from('broker_invoices')
    .select('id, broker_id, invoice_number, amount, amount_paid, status')
    .in('id', invoiceIds)

  if (invErr) {
    res.status(500).json({ error: invErr.message })
    return
  }

  const found = invoices || []
  if (found.length !== invoiceIds.length) {
    res.status(400).json({ error: 'One or more invoice_ids were not found' })
    return
  }

  const alreadyPaid = found.filter((i) => String(i.status) === 'paid')
  if (alreadyPaid.length) {
    res.status(400).json({
      error: 'One or more invoices are already paid',
      paid_ids: alreadyPaid.map((i) => i.id),
    })
    return
  }

  const notOpen = found.filter((i) => !OPEN_STATUSES.has(String(i.status)))
  if (notOpen.length) {
    res.status(400).json({
      error: 'Invoices must be draft, sent, overdue, or partial',
      invalid_ids: notOpen.map((i) => i.id),
    })
    return
  }

  const items = found.map((inv) => ({
    invoice_id: inv.id as string,
    broker_agent_id: inv.broker_id as string,
    amount_aed: outstanding(inv as { amount: number; amount_paid: number }),
    prev_status: String(inv.status),
  }))

  const total = Math.round(items.reduce((s, i) => s + i.amount_aed, 0) * 100) / 100
  if (total <= 0) {
    res.status(400).json({ error: 'Selected invoices have no outstanding balance' })
    return
  }

  let runId: string | null = null
  const updatedIds: string[] = []

  try {
    const { data: run, error: runErr } = await supabase
      .from('payment_runs')
      .insert({
        run_date,
        payment_method,
        payment_reference,
        total_amount_aed: total,
        invoice_count: items.length,
        notes,
        created_by: caller.agentId,
      })
      .select('id')
      .single()

    if (runErr || !run) {
      throw new Error(runErr?.message || 'Failed to create payment_runs row')
    }
    runId = (run as { id: string }).id

    const { error: itemsErr } = await supabase.from('payment_run_items').insert(
      items.map((i) => ({
        payment_run_id: runId,
        invoice_id: i.invoice_id,
        amount_aed: i.amount_aed,
        broker_agent_id: i.broker_agent_id,
      }))
    )

    if (itemsErr) {
      throw new Error(itemsErr.message)
    }

    const paidAt = new Date().toISOString()
    for (const item of items) {
      const inv = found.find((f) => f.id === item.invoice_id)!
      const fullAmount = Number(inv.amount) || 0
      const { error: updErr } = await supabase
        .from('broker_invoices')
        .update({
          status: 'paid',
          paid_at: paidAt,
          amount_paid: fullAmount,
          payment_method,
          payment_reference,
          emi_plan: false,
        } as never)
        .eq('id', item.invoice_id)
        .neq('status', 'paid')

      if (updErr) {
        throw new Error(updErr.message)
      }
      updatedIds.push(item.invoice_id)
    }

    res.status(201).json({
      run_id: runId,
      total_amount_aed: total,
      invoice_count: items.length,
      payment_reference,
      payment_method,
      run_date,
    })
  } catch (e) {
    console.error('[payment-runs] create failed — rolling back', e)

    // Best-effort rollback: restore invoices we flipped, delete run (cascades items)
    for (const id of updatedIds) {
      const item = items.find((i) => i.invoice_id === id)
      const inv = found.find((f) => f.id === id)
      if (!item || !inv) continue
      await supabase
        .from('broker_invoices')
        .update({
          status: item.prev_status,
          paid_at: null,
          amount_paid: Number(inv.amount_paid) || 0,
          payment_reference: null,
        } as never)
        .eq('id', id)
    }

    if (runId) {
      await supabase.from('payment_runs').delete().eq('id', runId)
    }

    res.status(500).json({
      error: e instanceof Error ? e.message : 'Payment run failed',
    })
  }
}

/** Open invoices for the Payment Run UI (manager/owner). */
export async function listOpenInvoicesForPaymentRunHandler(
  supabase: SupabaseClient,
  req: Request,
  res: Response
): Promise<void> {
  const caller = await resolveManager(req, supabase)
  if (!caller) {
    res.status(401).json({ error: 'Unauthorized — manager/owner required' })
    return
  }

  const { data, error } = await supabase
    .from('broker_invoices')
    .select(
      `
      *,
      agents:broker_id ( id, full_name, email ),
      deals:commission_id ( id, project_name, unit_number, client_name, commission_status )
    `
    )
    .in('status', ['draft', 'sent', 'overdue', 'partial'])
    .order('due_date', { ascending: true, nullsFirst: false })

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  const invoices = (data || []).map((row) => {
    const r = row as Record<string, unknown> & {
      amount?: number
      amount_paid?: number
      due_date?: string | null
    }
    const due = r.due_date ? new Date(r.due_date) : null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    let days_overdue = 0
    if (due) {
      const d = new Date(due)
      d.setHours(0, 0, 0, 0)
      days_overdue = Math.max(0, Math.floor((today.getTime() - d.getTime()) / 86400000))
    }
    return {
      ...r,
      outstanding_aed: outstanding(r),
      days_overdue,
    }
  })

  res.json({ invoices })
}
