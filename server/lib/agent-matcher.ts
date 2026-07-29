import type { SupabaseClient } from '@supabase/supabase-js'

export interface MatchInput {
  zip_code?: string
  specialty_tags?: string[]
  /** Lead temperature (Hot/Warm/Cold/Dead). Compared case-insensitively. */
  score_label?: string | null
  /**
   * When true (default), Hot leads pick highest broker_rank_score among the
   * same eligible pool (available → under max_leads → zip/specialty).
   * When false, always use workload / round-robin.
   * Portal intake leaves this unset and omits score_label (Option A: inactive).
   */
  useRankForHotLeads?: boolean
}

export type MatchReason =
  | 'rank_hot'
  | 'workload_zip'
  | 'workload_specialty'
  | 'workload_lowest'
  | 'workload_round_robin'
  | 'rank_fallback_workload'

type WorkloadRow = {
  id: string
  full_name: string | null
  zip_codes: string[] | null
  specialty_tags: string[] | null
  max_leads: number | null
  is_available: boolean | null
  active_lead_count: number
}

function normaliseZip(z: string): string {
  return String(z || '').replace(/\D/g, '')
}

function zipMatches(agentZips: string[] | null | undefined, needle: string): boolean {
  const n = normaliseZip(needle)
  if (!n) return false
  if (!agentZips || !Array.isArray(agentZips)) return false
  return agentZips.some((z) => {
    const zd = normaliseZip(String(z))
    return zd === n || zd.endsWith(n) || n.endsWith(zd)
  })
}

function tagMatches(agentTags: string[] | null | undefined, wanted: string[]): boolean {
  if (!agentTags?.length || !wanted.length) return false
  const lower = agentTags.map((t) => String(t).toLowerCase())
  return wanted.some((t) => lower.includes(String(t).toLowerCase()))
}

export function extractZip(location?: string | null): string | undefined {
  if (!location) return undefined
  const match = location.match(/\b\d{5,6}\b/)
  return match ? match[0] : undefined
}

function isHotLabel(label?: string | null): boolean {
  return String(label || '').trim().toLowerCase() === 'hot'
}

/** Narrow pool the same way today's matcher does (zip → specialty → all eligible). */
function buildCandidatePool(eligible: WorkloadRow[], input: MatchInput): WorkloadRow[] {
  if (input.zip_code) {
    const zipMatch = eligible.filter((a) => zipMatches(a.zip_codes, input.zip_code!))
    if (zipMatch.length > 0) return zipMatch
  }
  if (input.specialty_tags && input.specialty_tags.length > 0) {
    const tagMatch = eligible.filter((a) => tagMatches(a.specialty_tags, input.specialty_tags!))
    if (tagMatch.length > 0) return tagMatch
  }
  return eligible
}

async function pickHighestRank(
  supabase: SupabaseClient,
  candidates: WorkloadRow[]
): Promise<{ id: string; score: number } | null> {
  const ids = candidates.map((c) => c.id)
  const { data, error } = await supabase.from('agents').select('id, broker_rank_score').in('id', ids)

  if (error) {
    console.warn(
      '[agent-matcher] broker_rank_score fetch failed; falling back to workload:',
      error.message
    )
    return null
  }

  const scoreById = new Map<string, number>()
  for (const row of data || []) {
    const r = row as { id: string; broker_rank_score?: number | null }
    scoreById.set(r.id, Number(r.broker_rank_score ?? 0))
  }

  let bestId: string | null = null
  let bestScore = 0
  for (const c of candidates) {
    const s = scoreById.get(c.id) ?? 0
    if (s > bestScore) {
      bestScore = s
      bestId = c.id
    } else if (s === bestScore && s > 0 && bestId) {
      const cur = candidates.find((x) => x.id === bestId)!
      if ((c.active_lead_count ?? 0) < (cur.active_lead_count ?? 0)) bestId = c.id
    }
  }

  if (!bestId || bestScore <= 0) return null
  return { id: bestId, score: bestScore }
}

async function pickByWorkload(
  supabase: SupabaseClient,
  pool: WorkloadRow[]
): Promise<{ id: string; reason: MatchReason }> {
  const sorted = [...pool].sort(
    (a, b) => (a.active_lead_count ?? 0) - (b.active_lead_count ?? 0)
  )
  const lowest = sorted[0].active_lead_count ?? 0
  const tied = sorted.filter((a) => (a.active_lead_count ?? 0) === lowest)
  if (tied.length === 1) {
    return { id: tied[0].id, reason: 'workload_lowest' }
  }

  const { data: rr } = await supabase
    .from('agent_round_robin')
    .select('last_index')
    .eq('id', 1)
    .maybeSingle()
  const last = typeof rr?.last_index === 'number' ? rr.last_index : 0
  const nextIndex = (last + 1) % tied.length
  await supabase.from('agent_round_robin').update({ last_index: nextIndex }).eq('id', 1)
  return { id: tied[nextIndex].id, reason: 'workload_round_robin' }
}

/**
 * Assign an available agent.
 * Rank path only runs when score_label is Hot AND useRankForHotLeads !== false.
 * Missing/zero ranks fall back to workload — never blocks assignment.
 */
export async function matchAgent(
  supabase: SupabaseClient,
  input: MatchInput
): Promise<string | null> {
  const { data: agents, error } = await supabase
    .from('agent_workload')
    .select('*')
    .eq('is_available', true)

  if (error) {
    console.error('[agent-matcher] agent_workload query failed:', error.message)
    return null
  }
  if (!agents?.length) return null

  const rows = agents as WorkloadRow[]
  const eligible = rows.filter((a) => (a.active_lead_count ?? 0) < (a.max_leads ?? 50))
  if (eligible.length === 0) return null

  const pool = buildCandidatePool(eligible, input)
  const useRank = input.useRankForHotLeads !== false

  if (useRank && isHotLabel(input.score_label)) {
    const ranked = await pickHighestRank(supabase, pool)
    if (ranked) {
      console.log(
        `[agent-matcher] reason=rank_hot agent=${ranked.id} score=${ranked.score} pool=${pool.length}`
      )
      return ranked.id
    }
    const fallback = await pickByWorkload(supabase, pool)
    console.log(
      `[agent-matcher] reason=rank_fallback_workload agent=${fallback.id} (no usable broker_rank_score in pool)`
    )
    return fallback.id
  }

  const picked = await pickByWorkload(supabase, pool)
  let poolKind: MatchReason = picked.reason
  if (input.zip_code && pool.length < eligible.length) {
    const allZip = pool.every((p) => zipMatches(p.zip_codes, input.zip_code!))
    if (allZip) poolKind = 'workload_zip'
  } else if (input.specialty_tags?.length && pool.length < eligible.length) {
    poolKind = 'workload_specialty'
  }
  console.log(`[agent-matcher] reason=${poolKind} agent=${picked.id}`)
  return picked.id
}
