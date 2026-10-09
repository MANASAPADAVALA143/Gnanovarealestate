import { NextRequest, NextResponse } from 'next/server'
import { isAgentAuth, requireAgent } from '@/lib/require-agent'
import { getSupabaseServiceClient } from '@/lib/supabase-service'

export const runtime = 'nodejs'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAgent(req)
    if (!isAgentAuth(auth)) return auth

    const taskId = params.id?.trim()
    if (!taskId) return NextResponse.json({ error: 'Task id required' }, { status: 400 })

    const supabase = getSupabaseServiceClient()
    const { data, error } = await supabase
      .from('lead_tasks')
      .update({ status: 'completed' })
      .eq('id', taskId)
      .select('id, lead_id, status')
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

    if (data.lead_id) {
      await supabase.from('lead_activities').insert({
        lead_id: data.lead_id,
        type: 'task',
        content: 'Task marked completed',
        created_by: auth.agentId,
      })
    }

    return NextResponse.json({ task: data })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
