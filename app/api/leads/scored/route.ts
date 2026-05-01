import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '../../../../lib/supabase-service'

export const runtime = 'nodejs'

function startOfWeekUtc(d: Date): Date {
  const x = new Date(d)
  const day = x.getUTCDay()
  x.setUTCDate(x.getUTCDate() - day)
  x.setUTCHours(0, 0, 0, 0)
  return x
}

type LeadRow = Record<string, unknown>

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const minScore = Math.min(100, Math.max(0, Number(searchParams.get('minScore') ?? 0)))
    const maxScore = Math.min(100, Math.max(0, Number(searchParams.get('maxScore') ?? 100)))
    const minClamped = Math.min(minScore, maxScore)
    const maxClamped = Math.max(minScore, maxScore)
    const location = (searchParams.get('location') || '').trim()
    const campaignId = (searchParams.get('campaignId') || '').trim()
    const limit = Math.min(500, Math.max(1, Number(searchParams.get('limit') ?? 200)))

    const supabase = getSupabaseServiceClient()
    const weekStart = startOfWeekUtc(new Date()).toISOString()

    const { count: connectedThisWeek, error: connErr } = await supabase
      .from('campaign_leads')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gt('duration_seconds', 15)
      .gte('updated_at', weekStart)

    if (connErr) {
      console.error('[leads/scored] connected count:', connErr.message)
    }

    async function baseLeadsQuery() {
      let q = supabase.from('leads').select('*').not('lead_score', 'is', null)
      if (location) q = q.eq('location', location)
      if (campaignId) {
        const { data: cl, error: clErr } = await supabase
          .from('campaign_leads')
          .select('lead_id')
          .eq('campaign_id', campaignId)
        if (clErr) throw new Error(clErr.message)
        const ids = [...new Set((cl || []).map((r) => (r as { lead_id: string }).lead_id))]
        if (ids.length === 0) {
          return null
        }
        q = q.in('id', ids)
      }
      return q
    }

    const statsBuilder = await baseLeadsQuery()
    if (statsBuilder === null) {
      return NextResponse.json({
        leads: [],
        stats: {
          total: 0,
          hotCount: 0,
          hotReadyCount: 0,
          avgScore: 0,
          connectedThisWeek: connectedThisWeek ?? 0,
        },
      })
    }

    const { data: statsRows, error: statsErr } = await statsBuilder
    if (statsErr) throw new Error(statsErr.message)

    const allFiltered = (statsRows || []) as LeadRow[]
    const scores = allFiltered
      .map((r) => r.lead_score as number | null)
      .filter((s): s is number => typeof s === 'number')
    const total = allFiltered.length
    const hotCount = allFiltered.filter((r) => {
      const s = r.lead_score as number | null
      return typeof s === 'number' && s >= 80
    }).length
    const hotReadyCount = allFiltered.filter((r) => {
      const s = r.lead_score as number | null
      const done = r.manual_call_done as boolean | null | undefined
      return typeof s === 'number' && s >= 80 && done !== true
    }).length
    const avgScore =
      scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0

    let tableQuery = supabase
      .from('leads')
      .select('*')
      .not('lead_score', 'is', null)
      .gte('lead_score', minClamped)
      .lte('lead_score', maxClamped)
      .order('lead_score', { ascending: false })
      .limit(limit)

    if (location) tableQuery = tableQuery.eq('location', location)
    if (campaignId) {
      const { data: cl2, error: cl2Err } = await supabase
        .from('campaign_leads')
        .select('lead_id')
        .eq('campaign_id', campaignId)
      if (cl2Err) throw new Error(cl2Err.message)
      const ids2 = [...new Set((cl2 || []).map((r) => (r as { lead_id: string }).lead_id))]
      if (ids2.length === 0) {
        return NextResponse.json({
          leads: [],
          stats: {
            total,
            hotCount,
            hotReadyCount,
            avgScore,
            connectedThisWeek: connectedThisWeek ?? 0,
          },
        })
      }
      tableQuery = tableQuery.in('id', ids2)
    }

    const { data: tableRows, error: tableErr } = await tableQuery
    if (tableErr) throw new Error(tableErr.message)

    const leads = (tableRows || []) as LeadRow[]
    const leadIds = leads.map((l) => l.id as string)
    const campaignByLead = new Map<
      string,
      { name: string; calledAt: string | null; transcript: string | null }
    >()

    if (leadIds.length) {
      const { data: clRows, error: rErr } = await supabase
        .from('campaign_leads')
        .select('lead_id, called_at, transcript, updated_at, lead_score, campaign_id')
        .in('lead_id', leadIds)
        .not('lead_score', 'is', null)

      if (rErr) throw new Error(rErr.message)

      const campIds = [
        ...new Set((clRows || []).map((r) => (r as { campaign_id: string }).campaign_id).filter(Boolean)),
      ]
      let campNames = new Map<string, string>()
      if (campIds.length) {
        const { data: camps, error: cErr } = await supabase
          .from('outbound_campaigns')
          .select('id,name')
          .in('id', campIds)
        if (!cErr && camps) {
          campNames = new Map((camps as { id: string; name: string }[]).map((c) => [c.id, c.name]))
        }
      }

      const byLead = new Map<string, typeof clRows>()
      for (const r of clRows || []) {
        const row = r as {
          lead_id: string
          called_at: string | null
          transcript: string | null
          updated_at: string | null
          campaign_id: string
        }
        const arr = byLead.get(row.lead_id) || []
        arr.push(r)
        byLead.set(row.lead_id, arr)
      }

      for (const lid of leadIds) {
        const rows = byLead.get(lid) || []
        if (!rows.length) continue
        const sorted = [...rows].sort((a, b) => {
          const ta = new Date((a as { updated_at?: string }).updated_at || 0).getTime()
          const tb = new Date((b as { updated_at?: string }).updated_at || 0).getTime()
          return tb - ta
        })
        const top = sorted[0] as {
          campaign_id: string
          called_at: string | null
          transcript: string | null
        }
        campaignByLead.set(lid, {
          name: campNames.get(top.campaign_id) || '—',
          calledAt: top.called_at,
          transcript: top.transcript,
        })
      }
    }

    const out = leads.map((l, idx) => {
      const id = l.id as string
      const camp = campaignByLead.get(id)
      const transcript =
        (camp?.transcript && String(camp.transcript)) ||
        (typeof l.call_transcript === 'string' ? l.call_transcript : '') ||
        ''
      return {
        rank: idx + 1,
        id,
        name: (l.name as string) || '',
        phone: (l.phone as string) || '',
        location: (l.location as string | null) ?? null,
        lead_score: l.lead_score as number,
        score_label: (l.score_label as string | null) ?? null,
        budget_mentioned: (l.budget_mentioned as string | null) ?? null,
        follow_up_action: (l.follow_up_action as string | null) ?? null,
        interested_in: (l.interested_in as string | null) ?? null,
        called_at: camp?.calledAt || (l.last_outbound_at as string | null) || null,
        campaign: camp?.name || '—',
        transcript,
        manual_call_done: Boolean(l.manual_call_done),
      }
    })

    return NextResponse.json({
      leads: out,
      stats: {
        total,
        hotCount,
        hotReadyCount,
        avgScore,
        connectedThisWeek: connectedThisWeek ?? 0,
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to load scored leads'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
