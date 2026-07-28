import { NextRequest, NextResponse } from 'next/server'
import { isAgentAuth, requireAgent } from '../../../../../lib/require-agent'
import { getSupabaseServiceClient } from '../../../../../lib/supabase-service'

export const runtime = 'nodejs'

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const auth = await requireAgent(req)
    if (!isAgentAuth(auth)) return auth

    const id = ctx.params.id
    const supabase = getSupabaseServiceClient()
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('outbound_campaigns')
      .update({ status: 'paused', updated_at: now })
      .eq('id', id)
      .eq('agent_id', auth.agentId)
      .select('id')
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Pause failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
