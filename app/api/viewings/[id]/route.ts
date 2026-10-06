import { NextRequest, NextResponse } from 'next/server'
import { isAgentAuth, requireAgent } from '../../../../lib/require-agent'
import { getSupabaseServiceClient } from '../../../../lib/supabase-service'

export const runtime = 'nodejs'

const STATUSES = new Set(['scheduled', 'confirmed', 'completed', 'no_show', 'cancelled'])
const INTEREST = new Set(['low', 'medium', 'high'])

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAgent(req)
    if (!isAgentAuth(auth)) return auth
    const body = (await req.json()) as {
      status?: string
      interest_level?: string
      feedback?: string
    }
    const patch: Record<string, unknown> = {}
    if (body.status) {
      if (!STATUSES.has(body.status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      patch.status = body.status
    }
    if (body.interest_level) {
      if (!INTEREST.has(body.interest_level)) {
        return NextResponse.json({ error: 'Invalid interest_level' }, { status: 400 })
      }
      patch.interest_level = body.interest_level
    }
    if (typeof body.feedback === 'string') patch.feedback = body.feedback

    const supabase = getSupabaseServiceClient()
    const { data, error } = await supabase
      .from('viewings')
      .update(patch)
      .eq('id', params.id)
      .eq('agent_id', auth.agentId)
      .select('*')
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return NextResponse.json({ error: 'Viewing not found' }, { status: 404 })
    return NextResponse.json({ viewing: data })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
