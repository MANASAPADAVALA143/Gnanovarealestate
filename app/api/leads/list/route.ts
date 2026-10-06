import { NextRequest, NextResponse } from 'next/server'
import { applyAgentClaimPoolFilter } from '../../../../lib/campaign-query'
import { isPipelineStage } from '../../../../lib/pipeline'
import { isAgentAuth, requireAgent } from '../../../../lib/require-agent'
import { getSupabaseServiceClient } from '../../../../lib/supabase-service'

export const runtime = 'nodejs'

const SCORE_LABELS = new Set(['hot', 'warm', 'cold'])

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAgent(req)
    if (!isAgentAuth(auth)) return auth

    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim()
    const stage = (searchParams.get('stage') || '').trim()
    const scoreLabel = (searchParams.get('scoreLabel') || '').trim().toLowerCase()
    const limit = Math.min(500, Math.max(1, Number(searchParams.get('limit') ?? 200)))

    if (stage && !isPipelineStage(stage)) {
      return NextResponse.json({ error: 'Invalid pipeline_stage' }, { status: 400 })
    }
    if (scoreLabel && !SCORE_LABELS.has(scoreLabel)) {
      return NextResponse.json({ error: 'Invalid score_label' }, { status: 400 })
    }

    const supabase = getSupabaseServiceClient()
    let query = supabase
      .from('leads')
      .select(
        'id, name, phone, email, location, status, source, pipeline_stage, lead_score, score_label, agent_id, created_at, updated_at, agents ( id, full_name )'
      )
      .order('created_at', { ascending: false })
      .limit(limit)

    query = applyAgentClaimPoolFilter(query, auth.agentId)

    if (stage) query = query.eq('pipeline_stage', stage)
    if (scoreLabel) query = query.ilike('score_label', scoreLabel)
    if (q) {
      const escaped = q.replace(/[%_,]/g, '')
      query = query.or(`name.ilike.%${escaped}%,phone.ilike.%${escaped}%,email.ilike.%${escaped}%`)
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)

    const leads = (data || []) as Record<string, unknown>[]
    const ids = leads.map((r) => r.id as string)
    const lastActivity: Record<string, string> = {}

    if (ids.length > 0) {
      const { data: acts, error: actErr } = await supabase
        .from('lead_activities')
        .select('lead_id, created_at')
        .in('lead_id', ids)
        .order('created_at', { ascending: false })
        .limit(2000)

      if (actErr) {
        console.warn('[leads/list] activities:', actErr.message)
      } else {
        for (const row of acts || []) {
          const leadId = (row as { lead_id: string }).lead_id
          if (!lastActivity[leadId]) {
            lastActivity[leadId] = (row as { created_at: string }).created_at
          }
        }
      }
    }

    const rows = leads.map((lead) => {
      const agentEmbed = lead.agents as { id?: string; full_name?: string | null } | { id?: string; full_name?: string | null }[] | null
      const agent = Array.isArray(agentEmbed) ? agentEmbed[0] : agentEmbed
      return {
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        email: lead.email ?? null,
        location: lead.location ?? null,
        status: lead.status,
        source: lead.source ?? null,
        pipeline_stage: lead.pipeline_stage ?? 'new',
        lead_score: lead.lead_score ?? null,
        score_label: lead.score_label ?? null,
        agent_id: lead.agent_id ?? null,
        agent_name: agent?.full_name ?? null,
        created_at: lead.created_at,
        last_activity_at: lastActivity[lead.id as string] ?? lead.updated_at ?? lead.created_at,
      }
    })

    return NextResponse.json({ leads: rows })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
