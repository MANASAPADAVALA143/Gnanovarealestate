import { NextRequest, NextResponse } from 'next/server'
import { isDealStage } from '../../../../lib/pipeline'
import { isAgentAuth, requireAgent } from '../../../../lib/require-agent'
import { getSupabaseServiceClient } from '../../../../lib/supabase-service'

export const runtime = 'nodejs'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAgent(req)
    if (!isAgentAuth(auth)) return auth
    const supabase = getSupabaseServiceClient()
    const { data, error } = await supabase
      .from('deals')
      .select(
        '*, leads ( name, phone ), agents ( full_name )'
      )
      .eq('id', params.id)
      .eq('agent_id', auth.agentId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    return NextResponse.json({ deal: data })
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
    const body = (await req.json()) as { stage?: string; lost_reason?: string }
    if (!body.stage || !isDealStage(body.stage)) {
      return NextResponse.json({ error: 'Invalid stage' }, { status: 400 })
    }
    if (body.stage === 'closed_lost' && !body.lost_reason?.trim()) {
      return NextResponse.json({ error: 'lost_reason required for closed_lost' }, { status: 400 })
    }
    const supabase = getSupabaseServiceClient()
    const patch: Record<string, unknown> = {
      stage: body.stage,
      stage_entered_at: new Date().toISOString(),
    }
    if (body.lost_reason) patch.lost_reason = body.lost_reason
    if (body.stage === 'closed_won') patch.actual_close_date = new Date().toISOString().slice(0, 10)

    const { data, error } = await supabase
      .from('deals')
      .update(patch)
      .eq('id', params.id)
      .eq('agent_id', auth.agentId)
      .select('*')
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    return NextResponse.json({ deal: data })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
