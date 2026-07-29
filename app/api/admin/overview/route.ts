import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuth, requireManagerOrOwner } from '../../../../lib/require-admin'
import { getSupabaseServiceClient } from '../../../../lib/supabase-service'

export const runtime = 'nodejs'

function monthBounds(d: Date): { start: string; end: string } {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
  return { start: start.toISOString(), end: end.toISOString() }
}

export async function GET(req: NextRequest) {
  const auth = await requireManagerOrOwner(req)
  if (!isAdminAuth(auth)) return auth

  try {
    const supabase = getSupabaseServiceClient()

    const { data: agents, error: agentsErr } = await supabase
      .from('agents')
      .select('id, full_name')
      .order('full_name', { ascending: true })

    if (agentsErr) {
      return NextResponse.json({ error: agentsErr.message }, { status: 500 })
    }

    const { data: invoices, error: invErr } = await supabase
      .from('broker_invoices')
      .select('broker_id, amount, status')

    if (invErr) {
      return NextResponse.json({ error: invErr.message }, { status: 500 })
    }

    const nameById = new Map<string, string>()
    for (const a of agents || []) {
      const row = a as { id: string; full_name: string | null }
      nameById.set(row.id, row.full_name || 'Broker')
    }

    type BrokerRev = {
      broker_id: string
      broker_name: string
      paid_total: number
      pending_total: number
    }

    const byBroker = new Map<string, BrokerRev>()
    for (const a of agents || []) {
      const row = a as { id: string; full_name: string | null }
      byBroker.set(row.id, {
        broker_id: row.id,
        broker_name: row.full_name || 'Broker',
        paid_total: 0,
        pending_total: 0,
      })
    }

    let totalPaidRevenue = 0
    for (const inv of invoices || []) {
      const row = inv as { broker_id: string; amount: number | string; status: string }
      const amount = Number(row.amount) || 0
      let entry = byBroker.get(row.broker_id)
      if (!entry) {
        entry = {
          broker_id: row.broker_id,
          broker_name: nameById.get(row.broker_id) || 'Broker',
          paid_total: 0,
          pending_total: 0,
        }
        byBroker.set(row.broker_id, entry)
      }
      if (row.status === 'paid') {
        entry.paid_total += amount
        totalPaidRevenue += amount
      } else if (row.status === 'sent' || row.status === 'overdue' || row.status === 'partial' || row.status === 'draft') {
        entry.pending_total += amount
      }
    }

    const now = new Date()
    const thisMonth = monthBounds(now)
    const lastMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15))
    const lastMonth = monthBounds(lastMonthDate)

    async function countClosedWon(startIso: string, endIso: string): Promise<number> {
      const startDate = startIso.slice(0, 10)
      const endDate = endIso.slice(0, 10)
      const byClose = await supabase
        .from('deals')
        .select('id', { count: 'exact', head: true })
        .eq('stage', 'closed_won')
        .gte('actual_close_date', startDate)
        .lt('actual_close_date', endDate)

      if (!byClose.error) return byClose.count ?? 0

      const byStage = await supabase
        .from('deals')
        .select('id', { count: 'exact', head: true })
        .eq('stage', 'closed_won')
        .gte('stage_entered_at', startIso)
        .lt('stage_entered_at', endIso)

      return byStage.count ?? 0
    }

    const closedThisMonth = await countClosedWon(thisMonth.start, thisMonth.end)
    const closedLastMonth = await countClosedWon(lastMonth.start, lastMonth.end)

    const { data: commissions, error: comErr } = await supabase
      .from('deals')
      .select('agent_commission, commission_status')
      .in('commission_status', ['pending', 'approved'])

    if (comErr) {
      return NextResponse.json({ error: comErr.message }, { status: 500 })
    }

    let pendingCommissionTotal = 0
    let approvedCommissionTotal = 0
    for (const d of commissions || []) {
      const row = d as { agent_commission: number | string | null; commission_status: string }
      const amt = Number(row.agent_commission) || 0
      if (row.commission_status === 'pending') pendingCommissionTotal += amt
      if (row.commission_status === 'approved') approvedCommissionTotal += amt
    }

    const revenueByBroker = Array.from(byBroker.values()).sort(
      (a, b) => b.paid_total - a.paid_total || a.broker_name.localeCompare(b.broker_name)
    )

    return NextResponse.json({
      total_paid_revenue: Math.round(totalPaidRevenue * 100) / 100,
      revenue_by_broker: revenueByBroker,
      deals_closed_this_month: closedThisMonth,
      deals_closed_last_month: closedLastMonth,
      commission_pipeline: {
        pending_total: Math.round(pendingCommissionTotal * 100) / 100,
        approved_total: Math.round(approvedCommissionTotal * 100) / 100,
      },
      viewer: { agent_id: auth.agentId, is_owner: auth.isOwner },
    })
  } catch (e) {
    console.error('[admin/overview]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Overview failed' },
      { status: 500 }
    )
  }
}
