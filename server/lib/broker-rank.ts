/**
 * Broker merit rank calculator (Step A — additive only).
 *
 * Does NOT change agent-matcher.ts assignment. Hot-lead routing by rank = Step B.
 *
 * Manual trigger today:
 *   import { calculateBrokerRank } from './broker-rank'
 *   await calculateBrokerRank(supabase, agentId)
 *
 * Future scheduler (cron / n8n / pg_cron): call calculateBrokerRank for each
 * available agent on a daily/hourly cadence — do not build that here.
 *
 * ---------------------------------------------------------------------------
 * Weighting formula (tunable constants below) → broker_rank_score in [0, 100]
 * ---------------------------------------------------------------------------
 *   W_DEALS   0.35  × dealsClosedScore
 *   W_SPEED   0.25  × responseSpeedScore
 *   W_REVENUE 0.30  × revenueScore
 *   W_SAT     0.10  × satisfactionScore
 *
 * Component scoring (raw → 0–100 then weighted):
 *   dealsClosedScore:     min(deals_closed_90d / CAP_DEALS, 1) * 100
 *                         CAP_DEALS = 10 closed_won in last 90 days
 *   responseSpeedScore:   linear from 100 at ≤ FAST_SEC to 0 at ≥ SLOW_SEC
 *                         FAST_SEC = 60, SLOW_SEC = 86400 (24h)
 *                         Uses avg(leads.speed_to_lead_seconds) when present,
 *                         else avg(first_call_at - created_at) for agent leads.
 *   revenueScore:         min(paid_invoice_total / CAP_REVENUE_AED, 1) * 100
 *                         CAP_REVENUE_AED = 500_000 (paid broker_invoices only)
 *   satisfactionScore:    client_satisfaction_score 0–100 when stored later;
 *                         DEFAULT_SATISFACTION = 70 until a real source exists
 *                         (no NPS/reviews table yet — documented placeholder).
 *
 * active_lead_count is stored in rank_factors for transparency (from
 * agent_workload) but is NOT weighted into the score so this layer stays
 * separate from workload-based matching.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/** Tunable weights — must sum to 1.0 */
export const BROKER_RANK_WEIGHTS = {
  deals: 0.35,
  speed: 0.25,
  revenue: 0.3,
  satisfaction: 0.1,
} as const

export const BROKER_RANK_CAPS = {
  /** Closed-won deals in 90d that map to a full deals component score. */
  dealsClosed90d: 10,
  /** Paid invoice AED that maps to a full revenue component score. */
  revenueAed: 500_000,
  /** Response at or under this many seconds → full speed score. */
  fastResponseSec: 60,
  /** Response at or over this many seconds → zero speed score. */
  slowResponseSec: 86_400,
  /** Placeholder until a satisfaction source exists. */
  defaultSatisfaction: 70,
} as const

export type RankFactors = {
  deals_closed: number
  avg_response_time_seconds: number | null
  revenue_generated: number
  client_satisfaction_score: number
  active_lead_count: number
  window_days: number
  weights: typeof BROKER_RANK_WEIGHTS
  components: {
    deals: number
    speed: number
    revenue: number
    satisfaction: number
  }
}

export type BrokerRankResult = {
  agent_id: string
  broker_rank_score: number
  rank_factors: RankFactors
  rank_updated_at: string
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function isMissingColumnError(message: string | undefined): boolean {
  const msg = (message || '').toLowerCase()
  return (
    msg.includes('column') &&
    (msg.includes('does not exist') || msg.includes('could not find'))
  )
}

function isMissingRelationError(message: string | undefined): boolean {
  const msg = (message || '').toLowerCase()
  return msg.includes('could not find the table') || msg.includes('relation') && msg.includes('does not exist')
}

function isMissingCallsJoinColumnsError(message: string | undefined): boolean {
  const msg = (message || '').toLowerCase()
  return msg.includes('calls.lead_id') || msg.includes('calls.agent_id')
}

function scoreDeals(closed: number): number {
  return clamp01(closed / BROKER_RANK_CAPS.dealsClosed90d) * 100
}

function scoreSpeed(avgSec: number | null): number {
  if (avgSec == null || !Number.isFinite(avgSec) || avgSec < 0) {
    // No timing data → neutral mid score so agents without STL history aren't zeroed
    return 50
  }
  const { fastResponseSec: fast, slowResponseSec: slow } = BROKER_RANK_CAPS
  if (avgSec <= fast) return 100
  if (avgSec >= slow) return 0
  return ((slow - avgSec) / (slow - fast)) * 100
}

function scoreRevenue(aed: number): number {
  return clamp01(aed / BROKER_RANK_CAPS.revenueAed) * 100
}

function scoreSatisfaction(sat: number): number {
  return clamp01(sat / 100) * 100
}

export function computeBrokerRankScore(factors: {
  deals_closed: number
  avg_response_time_seconds: number | null
  revenue_generated: number
  client_satisfaction_score: number
}): { score: number; components: RankFactors['components'] } {
  const components = {
    deals: round2(scoreDeals(factors.deals_closed)),
    speed: round2(scoreSpeed(factors.avg_response_time_seconds)),
    revenue: round2(scoreRevenue(factors.revenue_generated)),
    satisfaction: round2(scoreSatisfaction(factors.client_satisfaction_score)),
  }
  const score = round2(
    components.deals * BROKER_RANK_WEIGHTS.deals +
      components.speed * BROKER_RANK_WEIGHTS.speed +
      components.revenue * BROKER_RANK_WEIGHTS.revenue +
      components.satisfaction * BROKER_RANK_WEIGHTS.satisfaction
  )
  return { score: Math.max(0, Math.min(100, score)), components }
}

/**
 * Recompute and persist broker_rank_score + rank_factors for one agent.
 * Uses service-role or manager-capable client (updates agents row).
 */
export async function calculateBrokerRank(
  supabase: SupabaseClient,
  agentId: string
): Promise<BrokerRankResult> {
  if (!agentId) throw new Error('agent_id is required')

  const since = new Date()
  since.setUTCDate(since.getUTCDate() - 90)
  const sinceIso = since.toISOString()

  // 1) Closed deals — last 90 days (prefer actual_close_date, fallback updated_at)
  const { data: closedDeals, error: dealsErr } = await supabase
    .from('deals')
    .select('id, actual_close_date, updated_at')
    .eq('agent_id', agentId)
    .eq('stage', 'closed_won')

  if (dealsErr) throw new Error(`deals query failed: ${dealsErr.message}`)

  const dealsClosed = (closedDeals || []).filter((d) => {
    const raw = (d as { actual_close_date?: string | null; updated_at?: string }).actual_close_date
      || (d as { updated_at?: string }).updated_at
    if (!raw) return false
    return new Date(raw).getTime() >= since.getTime()
  }).length

  // 2) Avg first-response — prefer leads.speed_to_lead_seconds; fallback from calls by lead
  const { data: leadRowsWithSpeed, error: leadsWithSpeedErr } = await supabase
    .from('leads')
    .select('id, created_at, speed_to_lead_seconds')
    .eq('agent_id', agentId)
    .gte('created_at', sinceIso)
    .limit(500)

  let leadRows: Array<{ id?: string; created_at?: string; speed_to_lead_seconds?: number | null }> =
    (leadRowsWithSpeed || []) as Array<{ id?: string; created_at?: string; speed_to_lead_seconds?: number | null }>

  if (leadsWithSpeedErr) {
    if (!isMissingColumnError(leadsWithSpeedErr.message)) {
      throw new Error(`leads query failed: ${leadsWithSpeedErr.message}`)
    }
    const { data: leadRowsNoSpeed, error: leadsNoSpeedErr } = await supabase
      .from('leads')
      .select('id, created_at')
      .eq('agent_id', agentId)
      .gte('created_at', sinceIso)
      .limit(500)
    if (leadsNoSpeedErr) throw new Error(`leads query failed: ${leadsNoSpeedErr.message}`)
    leadRows = (leadRowsNoSpeed || []) as Array<{ id?: string; created_at?: string }>
  }

  const responseSamples: number[] = []
  const leadsMissingSpeed: Array<{ id: string; created_at: string }> = []
  for (const row of leadRows) {
    const r = row as { id?: string; created_at?: string; speed_to_lead_seconds?: number | null }
    if (typeof r.speed_to_lead_seconds === 'number' && r.speed_to_lead_seconds >= 0) {
      responseSamples.push(r.speed_to_lead_seconds)
      continue
    }
    if (r.id && r.created_at) {
      leadsMissingSpeed.push({ id: r.id, created_at: r.created_at })
    }
  }

  if (leadsMissingSpeed.length > 0) {
    const leadIds = [...new Set(leadsMissingSpeed.map((l) => l.id))]
    const leadCreatedById = new Map(leadsMissingSpeed.map((l) => [l.id, l.created_at]))

    let callsRows:
      | Array<{ lead_id?: string | null; started_at?: string | null; created_at?: string | null }>
      | null = null

    const { data: callsWithStarted, error: callsWithStartedErr } = await supabase
      .from('calls')
      .select('lead_id, started_at, created_at')
      .eq('agent_id', agentId)
      .gte('created_at', sinceIso)
      .in('lead_id', leadIds)

    if (callsWithStartedErr && isMissingCallsJoinColumnsError(callsWithStartedErr.message)) {
      // Some DBs still lack calls.lead_id / calls.agent_id; skip call-join fallback.
      callsRows = []
    } else if (callsWithStartedErr && isMissingColumnError(callsWithStartedErr.message)) {
      const { data: callsNoStarted, error: callsNoStartedErr } = await supabase
        .from('calls')
        .select('lead_id, created_at')
        .eq('agent_id', agentId)
        .gte('created_at', sinceIso)
        .in('lead_id', leadIds)
      if (callsNoStartedErr) throw new Error(`calls query failed: ${callsNoStartedErr.message}`)
      callsRows = (callsNoStarted || []) as Array<{ lead_id?: string | null; created_at?: string | null }>
    } else if (callsWithStartedErr) {
      throw new Error(`calls query failed: ${callsWithStartedErr.message}`)
    } else {
      callsRows = (callsWithStarted || []) as Array<{
        lead_id?: string | null
        started_at?: string | null
        created_at?: string | null
      }>
    }

    const firstCallByLead = new Map<string, number>()
    for (const row of callsRows || []) {
      const leadId = row.lead_id ? String(row.lead_id) : null
      const callAt = row.started_at || row.created_at
      if (!leadId || !callAt) continue
      const ts = new Date(callAt).getTime()
      if (!Number.isFinite(ts)) continue
      const prev = firstCallByLead.get(leadId)
      if (prev == null || ts < prev) firstCallByLead.set(leadId, ts)
    }

    for (const leadId of leadIds) {
      const leadCreatedAt = leadCreatedById.get(leadId)
      const firstCallTs = firstCallByLead.get(leadId)
      if (!leadCreatedAt || firstCallTs == null) continue
      const sec = Math.round((firstCallTs - new Date(leadCreatedAt).getTime()) / 1000)
      if (sec >= 0 && sec < 86400 * 30) responseSamples.push(sec)
    }
  }

  const avgResponse =
    responseSamples.length > 0
      ? responseSamples.reduce((a, b) => a + b, 0) / responseSamples.length
      : null

  // 3) Paid commission revenue — broker_invoices status = paid
  const { data: invoices, error: invErr } = await supabase
    .from('broker_invoices')
    .select('amount')
    .eq('broker_id', agentId)
    .eq('status', 'paid')

  if (invErr) throw new Error(`broker_invoices query failed: ${invErr.message}`)

  let revenue = (invoices || []).reduce(
    (sum, row) => sum + Number((row as { amount?: number }).amount || 0),
    0
  )

  // Fallback: deals with commission_status = paid if no paid invoices yet
  if (revenue === 0) {
    const { data: paidDeals, error: pdErr } = await supabase
      .from('deals')
      .select('agent_commission')
      .eq('agent_id', agentId)
      .eq('commission_status', 'paid')
    if (!pdErr && paidDeals) {
      revenue = paidDeals.reduce(
        (sum, row) => sum + Number((row as { agent_commission?: number }).agent_commission || 0),
        0
      )
    }
  }

  // 4) active_lead_count — reuse agent_workload view (same as agent-matcher)
  const { data: workload, error: wlErr } = await supabase
    .from('agent_workload')
    .select('active_lead_count')
    .eq('id', agentId)
    .maybeSingle()

  if (wlErr && !isMissingColumnError(wlErr.message) && !isMissingRelationError(wlErr.message)) {
    throw new Error(`agent_workload query failed: ${wlErr.message}`)
  }
  const activeLeadCount = Number(
    (workload as { active_lead_count?: number } | null)?.active_lead_count ?? 0
  )

  // 5) Satisfaction placeholder (no reviews table yet)
  const clientSatisfaction = BROKER_RANK_CAPS.defaultSatisfaction

  const { score, components } = computeBrokerRankScore({
    deals_closed: dealsClosed,
    avg_response_time_seconds: avgResponse,
    revenue_generated: revenue,
    client_satisfaction_score: clientSatisfaction,
  })

  const rank_factors: RankFactors = {
    deals_closed: dealsClosed,
    avg_response_time_seconds:
      avgResponse == null ? null : round2(avgResponse),
    revenue_generated: round2(revenue),
    client_satisfaction_score: clientSatisfaction,
    active_lead_count: activeLeadCount,
    window_days: 90,
    weights: BROKER_RANK_WEIGHTS,
    components,
  }

  const rank_updated_at = new Date().toISOString()

  const { error: updErr } = await supabase
    .from('agents')
    .update({
      broker_rank_score: score,
      rank_factors,
      rank_updated_at,
    } as never)
    .eq('id', agentId)

  if (updErr) throw new Error(`agents update failed: ${updErr.message}`)

  return {
    agent_id: agentId,
    broker_rank_score: score,
    rank_factors,
    rank_updated_at,
  }
}

/** Recalculate for every agent with an agents row (manual / future cron entrypoint). */
export async function calculateBrokerRankForAll(
  supabase: SupabaseClient
): Promise<BrokerRankResult[]> {
  const { data: agents, error } = await supabase.from('agents').select('id')
  if (error) throw new Error(`agents list failed: ${error.message}`)
  const out: BrokerRankResult[] = []
  for (const row of agents || []) {
    const id = (row as { id: string }).id
    out.push(await calculateBrokerRank(supabase, id))
  }
  return out
}
