import { NextRequest, NextResponse } from 'next/server'
import { findAccessibleLead } from '@/lib/lead-access'
import { isAgentAuth, requireAgent } from '@/lib/require-agent'
import { getSupabaseServiceClient } from '@/lib/supabase-service'
import { getWorkspaceById } from '@/lib/workspace-server'

export const runtime = 'nodejs'

const LEAD_COLUMNS =
  'id, name, phone, email, location, status, source, pipeline_stage, lead_score, score_label, agent_id, created_at, updated_at, timeline, budget_mentioned, interested_in, follow_up_action, call_transcript, workspace_id, custom_fields, agents ( id, full_name )'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAgent(req)
    if (!isAgentAuth(auth)) return auth

    const leadId = params.id?.trim()
    if (!leadId) return NextResponse.json({ error: 'Lead id required' }, { status: 400 })

    const supabase = getSupabaseServiceClient()
    const lead = await findAccessibleLead(supabase, leadId, auth.agentId, LEAD_COLUMNS)
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    const agentEmbed = lead.agents as { id?: string; full_name?: string | null } | { id?: string; full_name?: string | null }[] | null
    const agent = Array.isArray(agentEmbed) ? agentEmbed[0] : agentEmbed
    const workspace = await getWorkspaceById(supabase, lead.workspace_id as string | null)

    return NextResponse.json({
      lead: {
        ...lead,
        agent_name: agent?.full_name ?? null,
        workspace_slug: workspace.slug,
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
