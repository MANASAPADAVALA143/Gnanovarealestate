import { NextRequest, NextResponse } from 'next/server'
import { isAgentAuth, requireAgent } from '../../../../lib/require-agent'
import { getSupabaseServiceClient } from '../../../../lib/supabase-service'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const auth = await requireAgent(req)
    if (!isAgentAuth(auth)) return auth

    const id = ctx.params.id
    const supabase = getSupabaseServiceClient()

    const { data: campaign, error: cErr } = await supabase
      .from('outbound_campaigns')
      .select(
        'id,name,status,created_at,started_at,completed_at,leads_count,total_leads,calls_made,calls_completed,calls_failed,calls_connected'
      )
      .eq('id', id)
      .eq('agent_id', auth.agentId)
      .maybeSingle()

    if (cErr || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const { data: clRows, error: rErr } = await supabase
      .from('campaign_leads')
      .select('id,status,lead_id,lead_score,score_label,vapi_call_id,called_at')
      .eq('campaign_id', id)
      .order('created_at', { ascending: true })

    if (rErr) throw new Error(rErr.message)

    const leadIds = [...new Set((clRows || []).map((r) => r.lead_id as string))]
    let leadMap = new Map<string, Record<string, unknown>>()
    if (leadIds.length) {
      const { data: leadRows, error: lErr } = await supabase
        .from('leads')
        .select('id,name,phone,location,lead_score,score_label')
        .in('id', leadIds)
      if (lErr) throw new Error(lErr.message)
      leadMap = new Map((leadRows || []).map((l) => [l.id as string, l as Record<string, unknown>]))
    }

    const leads = (clRows || []).map((r) => {
      const L = leadMap.get(r.lead_id as string) || {}
      const baseScore = (L.lead_score as number | null) ?? null
      const baseLabel = (L.score_label as string | null) ?? null
      return {
        campaignLeadId: r.id as string,
        status: r.status as string,
        lead_score: (r.lead_score as number | null) ?? baseScore,
        score_label: (r.score_label as string | null) ?? baseLabel,
        called_at: r.called_at as string | null,
        name: (L.name as string) || '',
        phone: (L.phone as string) || '',
        location: (L.location as string | null) ?? null,
      }
    })

    const total =
      (campaign.total_leads as number | null) ?? (campaign.leads_count as number | null) ?? 0
    const called =
      (clRows || []).filter((r) =>
        ['calling', 'completed', 'failed', 'no-answer'].includes(r.status as string)
      ).length || (campaign.calls_made as number | null) || 0
    const connected = (campaign.calls_connected as number | null) ?? 0
    const scores = leads.map((r) => r.lead_score).filter((s): s is number => typeof s === 'number')
    const avgScore =
      scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0

    return NextResponse.json({
      campaign,
      leads,
      stats: {
        total,
        called,
        connected,
        avgScore,
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to load campaign'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
