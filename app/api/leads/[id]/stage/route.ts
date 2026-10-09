import { NextRequest, NextResponse } from 'next/server'
import { findAccessibleLead } from '@/lib/lead-access'
import { isPipelineStage } from '@/lib/pipeline'
import { isAgentAuth, requireAgent } from '@/lib/require-agent'
import { getSupabaseServiceClient } from '@/lib/supabase-service'
import { getWorkspaceById } from '@/lib/workspace-server'

export const runtime = 'nodejs'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAgent(req)
    if (!isAgentAuth(auth)) return auth

    const leadId = params.id?.trim()
    if (!leadId) return NextResponse.json({ error: 'Lead id required' }, { status: 400 })

    const body = (await req.json()) as { pipeline_stage?: string; stage?: string }
    const stage = (body.pipeline_stage || body.stage || '').trim()
    if (!isPipelineStage(stage)) {
      return NextResponse.json({ error: 'Invalid pipeline_stage' }, { status: 400 })
    }

    const supabase = getSupabaseServiceClient()
    const existing = await findAccessibleLead(supabase, leadId, auth.agentId, 'id, workspace_id')
    if (!existing) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    const workspace = await getWorkspaceById(supabase, existing.workspace_id as string | null)
    if (!workspace.pipelineStages.includes(stage)) {
      return NextResponse.json(
        { error: `Stage "${stage}" is not part of the ${workspace.pipelineName} pipeline` },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('leads')
      .update({ pipeline_stage: stage, updated_at: new Date().toISOString() })
      .eq('id', leadId)
      .select('id, pipeline_stage')
      .single()

    if (error) throw new Error(error.message)

    return NextResponse.json({ lead: data })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
