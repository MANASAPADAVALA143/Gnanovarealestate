import { NextRequest, NextResponse } from 'next/server'
import { findAccessibleLead } from '@/lib/lead-access'
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

    const { data, error } = await supabase
      .from('viewings')
      .select(
        'id, lead_id, property_id, agent_id, scheduled_at, status, interest_level, feedback, client_name, properties ( title, address, city )'
      )
      .eq('lead_id', leadId)
      .order('scheduled_at', { ascending: false })

    if (error) throw new Error(error.message)
    return NextResponse.json({ viewings: data || [] })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
