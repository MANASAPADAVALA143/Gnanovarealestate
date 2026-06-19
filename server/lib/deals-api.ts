import type { Request, Response } from 'express'
import type { SupabaseClient } from '@supabase/supabase-js'

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

const AMOUNT_FIELDS = [
  'booking_amount',
  'token_amount',
  'sale_value',
  'commission_percent',
  'agent_commission',
  'brokerage_commission',
  'developer_incentive',
] as const

function isDealStage(value: string): value is DealStage {
  return (DEAL_STAGES as readonly string[]).includes(value)
}

function parseOptionalNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
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

export async function createDealHandler(
  supabase: SupabaseClient,
  req: Request,
  res: Response
): Promise<void> {
  try {
    const body = req.body || {}
    const { lead_id, agent_id, client_name, stage, unit_number, project_name } = body

    if (!lead_id && (!client_name || !String(client_name).trim())) {
      res.status(400).json({ error: 'lead_id or client_name is required' })
      return
    }

    if (stage && !isDealStage(stage)) {
      res.status(400).json({ error: 'Invalid stage' })
      return
    }

    if (stage === 'closed_lost' && !body.lost_reason?.trim()) {
      res.status(400).json({ error: 'lost_reason is required when stage is closed_lost' })
      return
    }

    const row: Record<string, unknown> = {
      lead_id: lead_id || null,
      agent_id: agent_id || null,
      client_name: client_name?.trim() || null,
      stage: stage || 'viewing',
      unit_number: unit_number || null,
      project_name: project_name || null,
      booking_amount: parseOptionalNumber(body.booking_amount) ?? null,
      token_amount: parseOptionalNumber(body.token_amount) ?? null,
      sale_value: parseOptionalNumber(body.sale_value) ?? null,
      commission_percent: parseOptionalNumber(body.commission_percent) ?? null,
      agent_commission: parseOptionalNumber(body.agent_commission) ?? null,
      brokerage_commission: parseOptionalNumber(body.brokerage_commission) ?? null,
      developer_incentive: parseOptionalNumber(body.developer_incentive) ?? null,
      lost_reason: body.lost_reason || null,
      expected_close_date: body.expected_close_date || null,
      actual_close_date: body.actual_close_date || null,
    }

    const { data, error } = await supabase.from('deals').insert(row).select('*').single()
    if (error) {
      console.error('[deals] create error:', error)
      res.status(500).json({ error: error.message })
      return
    }

    res.status(201).json({ deal: data })
  } catch (e) {
    console.error('[deals] create failed:', e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'Internal server error' })
  }
}

export async function listDealsHandler(
  supabase: SupabaseClient,
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { agent_id, stage, from, to } = req.query

    let q = supabase
      .from('deals')
      .select(
        '*, leads(name, phone), agents(full_name)'
      )
      .order('updated_at', { ascending: false })

    if (typeof agent_id === 'string' && agent_id) {
      q = q.eq('agent_id', agent_id)
    }
    if (typeof stage === 'string' && stage && isDealStage(stage)) {
      q = q.eq('stage', stage)
    }
    if (typeof from === 'string' && from) {
      q = q.gte('created_at', from)
    }
    if (typeof to === 'string' && to) {
      q = q.lte('created_at', to)
    }

    const { data, error } = await q
    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.json({ deals: data || [] })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Internal server error' })
  }
}

export async function getDealHandler(
  supabase: SupabaseClient,
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params

    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select('*, leads(name, phone, email), agents(full_name)')
      .eq('id', id)
      .maybeSingle()

    if (dealError) {
      res.status(500).json({ error: dealError.message })
      return
    }
    if (!deal) {
      res.status(404).json({ error: 'Deal not found' })
      return
    }

    const { data: activities, error: actError } = await supabase
      .from('deal_activities')
      .select('*')
      .eq('deal_id', id)
      .order('created_at', { ascending: false })

    if (actError) {
      res.status(500).json({ error: actError.message })
      return
    }

    res.json({ deal, activities: activities || [] })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Internal server error' })
  }
}

export async function updateDealHandler(
  supabase: SupabaseClient,
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params
    const body = req.body || {}

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

    const patch: Record<string, unknown> = {}
    const scalarFields = [
      'lead_id',
      'agent_id',
      'client_name',
      'unit_number',
      'project_name',
      'lost_reason',
      'expected_close_date',
      'actual_close_date',
    ] as const

    for (const key of scalarFields) {
      if (body[key] !== undefined) patch[key] = body[key]
    }

    for (const key of AMOUNT_FIELDS) {
      if (body[key] !== undefined) {
        const parsed = parseOptionalNumber(body[key])
        if (parsed === undefined && body[key] !== null && body[key] !== '') {
          res.status(400).json({ error: `Invalid number for ${key}` })
          return
        }
        patch[key] = parsed ?? null
      }
    }

    if (body.stage !== undefined) {
      if (!isDealStage(body.stage)) {
        res.status(400).json({ error: 'Invalid stage' })
        return
      }
      patch.stage = body.stage
    }

    const nextStage = (patch.stage as DealStage | undefined) ?? existing.stage
    const nextLostReason =
      patch.lost_reason !== undefined ? patch.lost_reason : existing.lost_reason
    if (nextStage === 'closed_lost' && (!nextLostReason || !String(nextLostReason).trim())) {
      res.status(400).json({ error: 'lost_reason is required when stage is closed_lost' })
      return
    }

    const amountChanges: string[] = []
    for (const key of AMOUNT_FIELDS) {
      if (patch[key] !== undefined && patch[key] !== existing[key as keyof typeof existing]) {
        amountChanges.push(`${key}: ${existing[key as keyof typeof existing] ?? '—'} → ${patch[key]}`)
      }
    }

    const { data, error } = await supabase
      .from('deals')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    if (amountChanges.length > 0) {
      await supabase.from('deal_activities').insert({
        deal_id: id,
        activity_type: 'amount_update',
        description: amountChanges.join('; '),
        created_by: body.updated_by || null,
      })
    }

    if (body.note?.trim()) {
      await supabase.from('deal_activities').insert({
        deal_id: id,
        activity_type: 'note',
        description: String(body.note).trim(),
        created_by: body.updated_by || null,
      })
    }

    res.json({ deal: data })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Internal server error' })
  }
}

export async function dealsSummaryHandler(
  supabase: SupabaseClient,
  req: Request,
  res: Response
): Promise<void> {
  try {
    const monthStart = startOfMonthIso()
    const monthEnd = endOfMonthIso()

    const { data: monthDeals, error } = await supabase
      .from('deals')
      .select(
        'id, stage, sale_value, agent_commission, agent_id, actual_close_date, updated_at, agents(full_name)'
      )
      .gte('updated_at', monthStart)
      .lte('updated_at', monthEnd)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    const deals = monthDeals || []
    const won = deals.filter((d) => d.stage === 'closed_won')
    const lost = deals.filter((d) => d.stage === 'closed_lost')
    const pending = deals.filter(
      (d) => d.stage !== 'closed_won' && d.stage !== 'closed_lost'
    )

    const totalSales = won.reduce((sum, d) => sum + (Number(d.sale_value) || 0), 0)
    const commissionEarned = won.reduce((sum, d) => sum + (Number(d.agent_commission) || 0), 0)
    const commissionPending = pending.reduce(
      (sum, d) => sum + (Number(d.agent_commission) || 0),
      0
    )

    const agentTotals = new Map<string, { full_name: string | null; sale_value: number }>()
    for (const d of won) {
      if (!d.agent_id) continue
      const cur = agentTotals.get(d.agent_id) || {
        full_name: (d.agents as { full_name?: string | null } | null)?.full_name ?? null,
        sale_value: 0,
      }
      cur.sale_value += Number(d.sale_value) || 0
      agentTotals.set(d.agent_id, cur)
    }

    const topAgents = Array.from(agentTotals.entries())
      .map(([agent_id, v]) => ({
        agent_id,
        full_name: v.full_name,
        sale_value: v.sale_value,
      }))
      .sort((a, b) => b.sale_value - a.sale_value)
      .slice(0, 3)

    res.json({
      month_start: monthStart,
      month_end: monthEnd,
      total_sales: totalSales,
      commission_earned: commissionEarned,
      commission_pending: commissionPending,
      deals_won: won.length,
      deals_lost: lost.length,
      top_agents: topAgents,
    })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Internal server error' })
  }
}
