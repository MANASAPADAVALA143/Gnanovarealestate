import { NextRequest, NextResponse } from 'next/server'
import { findAccessibleLead } from '@/lib/lead-access'
import { isLeadTaskType } from '@/lib/pipeline'
import { isAgentAuth, requireAgent } from '@/lib/require-agent'
import { getSupabaseServiceClient } from '@/lib/supabase-service'

export const runtime = 'nodejs'

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
    const lead = await findAccessibleLead(supabase, leadId, auth.agentId, 'id')
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    const status = (new URL(req.url).searchParams.get('status') || 'pending').trim()

    let q = supabase
      .from('lead_tasks')
      .select('id, lead_id, agent_id, due_at, type, status, created_at')
      .eq('lead_id', leadId)
      .order('due_at', { ascending: true })

    if (status && status !== 'all') q = q.eq('status', status)

    const { data, error } = await q
    if (error) throw new Error(error.message)

    return NextResponse.json({ tasks: data || [] })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAgent(req)
    if (!isAgentAuth(auth)) return auth

    const leadId = params.id?.trim()
    if (!leadId) return NextResponse.json({ error: 'Lead id required' }, { status: 400 })

    const body = (await req.json()) as { due_at?: string; type?: string }
    const type = (body.type || 'custom').trim()
    if (!isLeadTaskType(type)) {
      return NextResponse.json({ error: 'Invalid task type' }, { status: 400 })
    }
    const dueAt = body.due_at ? new Date(body.due_at) : new Date(Date.now() + 24 * 60 * 60 * 1000)
    if (Number.isNaN(dueAt.getTime())) {
      return NextResponse.json({ error: 'Invalid due_at' }, { status: 400 })
    }

    const supabase = getSupabaseServiceClient()
    const lead = await findAccessibleLead(supabase, leadId, auth.agentId, 'id')
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    const { data, error } = await supabase
      .from('lead_tasks')
      .insert({
        lead_id: leadId,
        agent_id: auth.agentId,
        due_at: dueAt.toISOString(),
        type,
        status: 'pending',
      })
      .select('id, lead_id, agent_id, due_at, type, status, created_at')
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ task: data }, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAgent(req)
    if (!isAgentAuth(auth)) return auth

    const leadId = params.id?.trim()
    const body = (await req.json()) as { taskId?: string; status?: string }
    const taskId = body.taskId?.trim()
    const status = (body.status || 'completed').trim()
    if (!taskId) return NextResponse.json({ error: 'taskId is required' }, { status: 400 })
    if (!['pending', 'completed', 'cancelled'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const supabase = getSupabaseServiceClient()
    const lead = await findAccessibleLead(supabase, leadId, auth.agentId, 'id')
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    const { data, error } = await supabase
      .from('lead_tasks')
      .update({ status })
      .eq('id', taskId)
      .eq('lead_id', leadId)
      .select('id, status')
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

    return NextResponse.json({ task: data })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
