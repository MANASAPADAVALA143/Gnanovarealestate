import type { Request, Response } from 'express'
import type { SupabaseClient } from '@supabase/supabase-js'

export const COMMISSION_STATUSES = ['pending', 'submitted', 'approved', 'paid'] as const
export type CommissionStatus = (typeof COMMISSION_STATUSES)[number]

const STATUS_RANK: Record<CommissionStatus, number> = {
  pending: 0,
  submitted: 1,
  approved: 2,
  paid: 3,
}

function isCommissionStatus(value: string): value is CommissionStatus {
  return (COMMISSION_STATUSES as readonly string[]).includes(value)
}

function transitionAllowed(oldStatus: CommissionStatus, newStatus: CommissionStatus): boolean {
  if (oldStatus === newStatus) return true
  if (newStatus === 'pending') return true
  return STATUS_RANK[newStatus] === STATUS_RANK[oldStatus] + 1
}

function startOfMonthIso(): string {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function endOfMonthIso(): string {
  const d = new Date()
  d.setMonth(d.getMonth() + 1, 0)
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
}

function statusChangedAt(deal: Record<string, unknown>): string | null {
  const status = deal.commission_status as CommissionStatus
  if (status === 'paid') return (deal.commission_paid_at as string) || null
  if (status === 'approved') return (deal.commission_approved_at as string) || null
  if (status === 'submitted') return (deal.commission_submitted_at as string) || null
  return (deal.updated_at as string) || null
}

async function isManager(supabase: SupabaseClient, agentId: string | null): Promise<boolean> {
  if (!agentId) return false
  const { data } = await supabase
    .from('agents')
    .select('is_manager')
    .eq('id', agentId)
    .maybeSingle()
  return Boolean((data as { is_manager?: boolean } | null)?.is_manager)
}

export async function updateCommissionHandler(
  supabase: SupabaseClient,
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params
    const body = req.body || {}
    const newStatus = body.commission_status as string | undefined
    const paymentRef = body.commission_payment_reference
    const allowMissingRef = Boolean(body.allow_missing_payment_reference)
    const updatedBy = (body.updated_by as string) || null

    if (!newStatus || !isCommissionStatus(newStatus)) {
      res.status(400).json({ error: 'commission_status is required (pending|submitted|approved|paid)' })
      return
    }

    const { data: existing, error: fetchError } = await supabase
      .from('deals')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) {
      res.status(500).json({ error: fetchError.message })
      return
    }
    if (!existing) {
      res.status(404).json({ error: 'Deal not found' })
      return
    }

    const oldStatus = (existing.commission_status || 'pending') as CommissionStatus

    if (!transitionAllowed(oldStatus, newStatus)) {
      res.status(400).json({
        error: `Invalid commission status transition: ${oldStatus} → ${newStatus}. Move one step forward or reset to pending.`,
      })
      return
    }

    if (
      newStatus !== 'pending' &&
      newStatus !== oldStatus &&
      existing.stage !== 'closed_won'
    ) {
      res.status(400).json({
        error:
          'Commission status can only advance when the deal stage is closed_won. Close the deal first, then update commission.',
        deal_stage: existing.stage,
      })
      return
    }

    const warnings: string[] = []
    const nextRef =
      paymentRef !== undefined
        ? paymentRef === null || paymentRef === ''
          ? null
          : String(paymentRef).trim()
        : existing.commission_payment_reference

    if (newStatus === 'paid' && (!nextRef || !String(nextRef).trim())) {
      if (!allowMissingRef) {
        res.status(422).json({
          error:
            'Payment reference is recommended when marking commission as paid. Re-submit with commission_payment_reference or set allow_missing_payment_reference: true to confirm.',
          code: 'payment_reference_recommended',
          can_override: true,
        })
        return
      }
      warnings.push(
        'Commission marked paid without a payment reference — add one later for finance reconciliation.'
      )
    }

    const patch: Record<string, unknown> = {
      commission_status: newStatus,
    }
    if (paymentRef !== undefined) {
      patch.commission_payment_reference = nextRef
    }

    const { data, error } = await supabase
      .from('deals')
      .update(patch)
      .eq('id', id)
      .select('*, leads(name, phone), agents(full_name)')
      .single()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.json({
      deal: data,
      warnings: warnings.length ? warnings : undefined,
      updated_by: updatedBy,
    })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Internal server error' })
  }
}

export async function listCommissionsHandler(
  supabase: SupabaseClient,
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { agent_id, status, from, to, stage } = req.query

    let q = supabase
      .from('deals')
      .select(
        '*, leads(name, phone), agents(full_name)'
      )
      .order('updated_at', { ascending: false })

    if (typeof agent_id === 'string' && agent_id) {
      q = q.eq('agent_id', agent_id)
    }
    if (typeof status === 'string' && status && isCommissionStatus(status)) {
      q = q.eq('commission_status', status)
    }
    if (typeof stage === 'string' && stage) {
      q = q.eq('stage', stage)
    } else {
      // Default: only show deals eligible for commission tracking
      q = q.eq('stage', 'closed_won')
    }
    if (typeof from === 'string' && from) {
      q = q.gte('updated_at', from)
    }
    if (typeof to === 'string' && to) {
      q = q.lte('updated_at', to)
    }

    const { data, error } = await q
    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    const commissions = (data || []).map((row) => ({
      ...row,
      status_changed_at: statusChangedAt(row as Record<string, unknown>),
    }))

    res.json({ commissions })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Internal server error' })
  }
}

export async function commissionsSummaryHandler(
  supabase: SupabaseClient,
  req: Request,
  res: Response
): Promise<void> {
  try {
    const monthStart = startOfMonthIso()
    const monthEnd = endOfMonthIso()

    const { data: allDeals, error: allError } = await supabase
      .from('deals')
      .select(
        'id, agent_id, stage, commission_status, agent_commission, commission_paid_at, commission_approved_at, updated_at, agents(full_name)'
      )
      .eq('stage', 'closed_won')

    if (allError) {
      res.status(500).json({ error: allError.message })
      return
    }

    const deals = allDeals || []
    const monthDeals = deals.filter((d) => {
      const ts = d.commission_paid_at || d.updated_at
      return ts && ts >= monthStart && ts <= monthEnd
    })

    function sumCommission(rows: typeof deals, status: CommissionStatus | CommissionStatus[]) {
      const statuses = Array.isArray(status) ? status : [status]
      return rows
        .filter((d) => statuses.includes((d.commission_status || 'pending') as CommissionStatus))
        .reduce((sum, d) => sum + (Number(d.agent_commission) || 0), 0)
    }

    const byAgent = new Map<
      string,
      { full_name: string | null; pending: number; approved: number; paid: number }
    >()

    for (const d of deals) {
      if (!d.agent_id) continue
      const cur = byAgent.get(d.agent_id) || {
        full_name: (d.agents as { full_name?: string | null } | null)?.full_name ?? null,
        pending: 0,
        approved: 0,
        paid: 0,
      }
      const amt = Number(d.agent_commission) || 0
      const st = (d.commission_status || 'pending') as CommissionStatus
      if (st === 'pending' || st === 'submitted') cur.pending += amt
      else if (st === 'approved') cur.approved += amt
      else if (st === 'paid') cur.paid += amt
      byAgent.set(d.agent_id, cur)
    }

    res.json({
      month_start: monthStart,
      month_end: monthEnd,
      all_time: {
        total_pending: sumCommission(deals, ['pending', 'submitted']),
        total_approved: sumCommission(deals, 'approved'),
        total_paid: sumCommission(deals, 'paid'),
      },
      this_month: {
        total_pending: sumCommission(monthDeals, ['pending', 'submitted']),
        total_approved: sumCommission(monthDeals, 'approved'),
        total_paid: sumCommission(
          monthDeals.filter((d) => d.commission_status === 'paid'),
          'paid'
        ),
      },
      by_agent: Array.from(byAgent.entries()).map(([agent_id, v]) => ({
        agent_id,
        ...v,
      })),
    })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Internal server error' })
  }
}

export async function bulkSubmitCommissionsHandler(
  supabase: SupabaseClient,
  req: Request,
  res: Response
): Promise<void> {
  try {
    const body = req.body || {}
    const dealIds = body.deal_ids as string[] | undefined
    const managerId = (body.manager_id as string) || null

    if (!Array.isArray(dealIds) || dealIds.length === 0) {
      res.status(400).json({ error: 'deal_ids array is required' })
      return
    }

    if (!(await isManager(supabase, managerId))) {
      res.status(403).json({ error: 'Only managers can bulk-submit commissions' })
      return
    }

    const results: Array<{ id: string; ok: boolean; error?: string }> = []

    for (const dealId of dealIds) {
      const { data: deal, error: fetchError } = await supabase
        .from('deals')
        .select('id, stage, commission_status')
        .eq('id', dealId)
        .maybeSingle()

      if (fetchError || !deal) {
        results.push({ id: dealId, ok: false, error: 'Deal not found' })
        continue
      }

      if (deal.stage !== 'closed_won') {
        results.push({
          id: dealId,
          ok: false,
          error: 'Deal must be closed_won before submitting commission',
        })
        continue
      }

      const oldStatus = (deal.commission_status || 'pending') as CommissionStatus
      if (oldStatus !== 'pending') {
        results.push({
          id: dealId,
          ok: false,
          error: `Cannot bulk-submit from status ${oldStatus}`,
        })
        continue
      }

      const { error: updateError } = await supabase
        .from('deals')
        .update({ commission_status: 'submitted' })
        .eq('id', dealId)

      if (updateError) {
        results.push({ id: dealId, ok: false, error: updateError.message })
      } else {
        results.push({ id: dealId, ok: true })
      }
    }

    const succeeded = results.filter((r) => r.ok).length
    res.json({ results, succeeded, failed: results.length - succeeded })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Internal server error' })
  }
}
