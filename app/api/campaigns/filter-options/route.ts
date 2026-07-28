import { NextRequest, NextResponse } from 'next/server'
import { applyAgentClaimPoolFilter } from '../../../../lib/campaign-query'
import { isAgentAuth, requireAgent } from '../../../../lib/require-agent'
import { getSupabaseServiceClient } from '../../../../lib/supabase-service'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAgent(req)
    if (!isAgentAuth(auth)) return auth

    const supabase = getSupabaseServiceClient()
    let q = supabase
      .from('leads')
      .select('location')
      .not('location', 'is', null)
      .neq('location', '')
      .limit(5000)
    q = applyAgentClaimPoolFilter(q, auth.agentId)

    const { data, error } = await q

    if (error) throw new Error(error.message)

    const set = new Set<string>()
    for (const row of data || []) {
      const loc = String((row as { location: string | null }).location || '').trim()
      if (loc) set.add(loc)
    }
    const locations = [...set].sort((a, b) => a.localeCompare(b))

    return NextResponse.json({ locations })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to load locations'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
