import { NextRequest, NextResponse } from 'next/server'
import { isAgentAuth, requireAgent } from '../../../../lib/require-agent'
import { getSupabaseServiceClient } from '../../../../lib/supabase-service'

export const runtime = 'nodejs'

const TZ = 'Asia/Kolkata'

const SOURCE_BUCKETS = ['99acres', 'magicbricks', 'zillow', 'facebook', 'website', 'other'] as const
export type SpeedSourceBucket = (typeof SOURCE_BUCKETS)[number]

function formatISTDateKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

function istDayBoundsISO(d: Date): { start: string; end: string } {
  const day = formatISTDateKey(d)
  return {
    start: new Date(`${day}T00:00:00+05:30`).toISOString(),
    end: new Date(`${day}T23:59:59.999+05:30`).toISOString(),
  }
}

function bucketSource(raw: string | null | undefined): SpeedSourceBucket {
  const s = (raw || '').toLowerCase().trim()
  if (s === '99acres' || s.includes('99acres') || s.includes('99 acres')) return '99acres'
  if (s === 'magicbricks' || s.includes('magicbrick')) return 'magicbricks'
  if (s === 'zillow') return 'zillow'
  if (s === 'facebook' || s === 'fb' || s === 'meta') return 'facebook'
  if (s === 'website' || s === 'web' || s === 'site' || s === 'contact_form') return 'website'
  return 'other'
}

function mean(nums: number[]): number | null {
  if (!nums.length) return null
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)
}

export type SpeedToLeadStatsResponse = {
  totalToday: number
  avgResponseSeconds: number | null
  hotLeadsToday: number
  fastestSeconds: number | null
  bySource: { source: SpeedSourceBucket; count: number; avgScore: number | null }[]
  recentLeads: Array<{
    id: string
    lead_id: string | null
    source: string | null
    property_interest: string | null
    response_seconds: number | null
    call_duration_seconds: number | null
    lead_score: number | null
    score_label: string | null
    call_status: string | null
    received_at: string | null
    lead: { name: string | null; phone: string | null; call_transcript: string | null } | null
  }>
  chartData: { date: string; avgSeconds: number | null }[]
}

/** Keep log rows whose lead is in the agent's claim pool (own or unassigned). */
async function filterLogsByAgentClaimPool<T extends { lead_id?: string | null }>(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  rows: T[],
  agentId: string
): Promise<T[]> {
  const leadIds = [
    ...new Set(
      rows
        .map((r) => r.lead_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    ),
  ]
  if (!leadIds.length) return []

  const { data: leads, error } = await supabase
    .from('leads')
    .select('id, agent_id')
    .in('id', leadIds)

  if (error) throw new Error(error.message)

  const allowed = new Set(
    (leads || [])
      .filter((l) => {
        const aid = (l as { agent_id: string | null }).agent_id
        return aid == null || aid === agentId
      })
      .map((l) => (l as { id: string }).id)
  )

  return rows.filter((r) => r.lead_id != null && allowed.has(String(r.lead_id)))
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAgent(req)
    if (!isAgentAuth(auth)) return auth

    const agentId = auth.agentId
    const supabase = getSupabaseServiceClient()
    const now = new Date()
    const { start: todayStart, end: todayEnd } = istDayBoundsISO(now)

    const chartDayKeys: string[] = []
    for (let i = 6; i >= 0; i--) {
      const t = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      chartDayKeys.push(formatISTDateKey(t))
    }

    const { data: todayRowsRaw, error: todayErr } = await supabase
      .from('speed_to_lead_log')
      .select('source, response_seconds, lead_score, call_status, lead_id')
      .gte('received_at', todayStart)
      .lte('received_at', todayEnd)

    if (todayErr) throw new Error(todayErr.message)

    const today = await filterLogsByAgentClaimPool(
      supabase,
      todayRowsRaw || [],
      agentId
    )

    const totalToday = today.length

    const responseVals = today
      .map((r) => r.response_seconds)
      .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v))
    const avgResponseSeconds = mean(responseVals)

    const hotLeadsToday = today.filter(
      (r) => typeof r.lead_score === 'number' && r.lead_score >= 80
    ).length

    const fastestSeconds =
      responseVals.length > 0 ? Math.min(...responseVals) : null

    const bySourceMap = new Map<
      SpeedSourceBucket,
      { scores: number[]; count: number }
    >()
    for (const b of SOURCE_BUCKETS) {
      bySourceMap.set(b, { scores: [], count: 0 })
    }

    for (const row of today) {
      const b = bucketSource(row.source as string | null)
      const cur = bySourceMap.get(b)!
      cur.count += 1
      if (typeof row.lead_score === 'number' && !Number.isNaN(row.lead_score)) {
        cur.scores.push(row.lead_score)
      }
    }

    const bySource: SpeedToLeadStatsResponse['bySource'] = SOURCE_BUCKETS.map((source) => {
      const cur = bySourceMap.get(source)!
      return {
        source,
        count: cur.count,
        avgScore: mean(cur.scores),
      }
    })

    const { data: recentRaw, error: recentErr } = await supabase
      .from('speed_to_lead_log')
      .select(
        'id, lead_id, source, property_interest, response_seconds, call_duration_seconds, lead_score, score_label, call_status, received_at, leads(name, phone, call_transcript)'
      )
      .order('received_at', { ascending: false })
      .limit(100)

    if (recentErr) throw new Error(recentErr.message)

    const recentFiltered = await filterLogsByAgentClaimPool(
      supabase,
      (recentRaw || []) as Array<{ lead_id?: string | null } & Record<string, unknown>>,
      agentId
    )
    const recentSlice = recentFiltered.slice(0, 50)

    const recentLeads = recentSlice.map((row) => {
      const r = row as Record<string, unknown>
      const leadsRaw = r.leads as Record<string, unknown> | Record<string, unknown>[] | null | undefined
      const leadsOne = Array.isArray(leadsRaw) ? leadsRaw[0] : leadsRaw
      const leads =
        leadsOne && typeof leadsOne === 'object' ? (leadsOne as Record<string, unknown>) : null
      return {
        id: String(r.id),
        lead_id: r.lead_id != null ? String(r.lead_id) : null,
        source: r.source != null ? String(r.source) : null,
        property_interest: r.property_interest != null ? String(r.property_interest) : null,
        response_seconds:
          typeof r.response_seconds === 'number' ? r.response_seconds : null,
        call_duration_seconds:
          typeof r.call_duration_seconds === 'number' ? r.call_duration_seconds : null,
        lead_score: typeof r.lead_score === 'number' ? r.lead_score : null,
        score_label: r.score_label != null ? String(r.score_label) : null,
        call_status: r.call_status != null ? String(r.call_status) : null,
        received_at: r.received_at != null ? String(r.received_at) : null,
        lead: leads
          ? {
              name: leads.name != null ? String(leads.name) : null,
              phone: leads.phone != null ? String(leads.phone) : null,
              call_transcript:
                leads.call_transcript != null ? String(leads.call_transcript) : null,
            }
          : null,
      }
    })

    const chartStart = new Date(`${chartDayKeys[0]}T00:00:00+05:30`).toISOString()

    const { data: chartRowsRaw, error: chartErr } = await supabase
      .from('speed_to_lead_log')
      .select('received_at, response_seconds, lead_id')
      .gte('received_at', chartStart)
      .not('response_seconds', 'is', null)

    if (chartErr) throw new Error(chartErr.message)

    const chartRows = await filterLogsByAgentClaimPool(
      supabase,
      chartRowsRaw || [],
      agentId
    )

    const bucketSeconds = new Map<string, number[]>()
    for (const k of chartDayKeys) {
      bucketSeconds.set(k, [])
    }
    for (const row of chartRows) {
      if (typeof row.response_seconds !== 'number') continue
      const key = formatISTDateKey(new Date(String(row.received_at)))
      if (!bucketSeconds.has(key)) continue
      bucketSeconds.get(key)!.push(row.response_seconds)
    }

    const chartData = chartDayKeys.map((date) => ({
      date,
      avgSeconds: mean(bucketSeconds.get(date) || []),
    }))

    const payload: SpeedToLeadStatsResponse = {
      totalToday,
      avgResponseSeconds,
      hotLeadsToday,
      fastestSeconds,
      bySource,
      recentLeads,
      chartData,
    }

    return NextResponse.json(payload)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to load speed-to-lead stats'
    console.error('[speed-to-lead/stats]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
