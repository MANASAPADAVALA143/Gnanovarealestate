import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuth, requireManagerOrOwner } from '../../../../lib/require-admin'
import { getSupabaseServiceClient } from '../../../../lib/supabase-service'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = await requireManagerOrOwner(req)
  if (!isAdminAuth(auth)) return auth

  try {
    const supabase = getSupabaseServiceClient()

    const { data: agents, error: agentsErr } = await supabase
      .from('agents')
      .select(
        'id, full_name, email, is_available, is_manager, is_owner, broker_rank_score, rank_factors, rank_updated_at'
      )
      .order('broker_rank_score', { ascending: false })

    if (agentsErr) {
      return NextResponse.json({ error: agentsErr.message }, { status: 500 })
    }

    const ids = (agents || []).map((a) => (a as { id: string }).id)
    const activeByAgent = new Map<string, number>()
    const deals90ByAgent = new Map<string, number>()
    const lastActiveByAgent = new Map<string, string | null>()

    if (ids.length) {
      const { data: workload } = await supabase
        .from('agent_workload')
        .select('agent_id, active_lead_count')
        .in('agent_id', ids)

      for (const w of workload || []) {
        const row = w as { agent_id: string; active_lead_count: number | null }
        activeByAgent.set(row.agent_id, Number(row.active_lead_count) || 0)
      }

      // Fallback active leads if workload view missing rows
      if (!workload?.length) {
        const { data: leads } = await supabase
          .from('leads')
          .select('agent_id, status')
          .in('agent_id', ids)

        const closedStatuses = new Set(['closed', 'lost', 'converted', 'dead', 'won'])
        for (const l of leads || []) {
          const row = l as { agent_id: string | null; status: string | null }
          if (!row.agent_id) continue
          if (row.status && closedStatuses.has(String(row.status).toLowerCase())) continue
          activeByAgent.set(row.agent_id, (activeByAgent.get(row.agent_id) || 0) + 1)
        }
      }

      const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
      const { data: closed } = await supabase
        .from('deals')
        .select('agent_id, stage_entered_at, actual_close_date')
        .eq('stage', 'closed_won')
        .in('agent_id', ids)

      for (const d of closed || []) {
        const row = d as {
          agent_id: string | null
          stage_entered_at: string | null
          actual_close_date: string | null
        }
        if (!row.agent_id) continue
        const when = row.actual_close_date
          ? new Date(row.actual_close_date).toISOString()
          : row.stage_entered_at
        if (!when || when < since90) continue
        deals90ByAgent.set(row.agent_id, (deals90ByAgent.get(row.agent_id) || 0) + 1)
      }

      const { data: leadUpdates } = await supabase
        .from('leads')
        .select('agent_id, updated_at')
        .in('agent_id', ids)
        .order('updated_at', { ascending: false })
        .limit(500)

      for (const l of leadUpdates || []) {
        const row = l as { agent_id: string | null; updated_at: string | null }
        if (!row.agent_id || !row.updated_at) continue
        const prev = lastActiveByAgent.get(row.agent_id)
        if (!prev || row.updated_at > prev) {
          lastActiveByAgent.set(row.agent_id, row.updated_at)
        }
      }

      const { data: callUpdates } = await supabase
        .from('calls')
        .select('agent_id, created_at')
        .in('agent_id', ids)
        .order('created_at', { ascending: false })
        .limit(500)

      for (const c of callUpdates || []) {
        const row = c as { agent_id: string | null; created_at: string | null }
        if (!row.agent_id || !row.created_at) continue
        const prev = lastActiveByAgent.get(row.agent_id)
        if (!prev || row.created_at > prev) {
          lastActiveByAgent.set(row.agent_id, row.created_at)
        }
      }
    }

    const brokers = (agents || []).map((a) => {
      const row = a as {
        id: string
        full_name: string | null
        email: string | null
        is_available: boolean | null
        is_manager: boolean | null
        is_owner: boolean | null
        broker_rank_score: number | null
        rank_factors: Record<string, unknown> | null
        rank_updated_at: string | null
      }
      return {
        id: row.id,
        full_name: row.full_name,
        email: row.email,
        is_available: row.is_available !== false,
        is_manager: Boolean(row.is_manager),
        is_owner: Boolean(row.is_owner),
        broker_rank_score: Number(row.broker_rank_score) || 0,
        rank_factors: row.rank_factors || {},
        rank_updated_at: row.rank_updated_at,
        active_lead_count: activeByAgent.get(row.id) || 0,
        deals_closed_90d: deals90ByAgent.get(row.id) || 0,
        last_active: lastActiveByAgent.get(row.id) || null,
      }
    })

    return NextResponse.json({
      brokers,
      viewer: { agent_id: auth.agentId, is_owner: auth.isOwner },
    })
  } catch (e) {
    console.error('[admin/brokers]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Brokers list failed' },
      { status: 500 }
    )
  }
}
