import { NextRequest, NextResponse } from 'next/server'
import { applyAgentClaimPoolFilter } from '../../../lib/campaign-query'
import { isAgentAuth, requireAgent } from '../../../lib/require-agent'
import { getSupabaseServiceClient } from '../../../lib/supabase-service'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAgent(req)
    if (!isAgentAuth(auth)) return auth

    const supabase = getSupabaseServiceClient()
    let leadQuery = supabase.from('leads').select('id')
    leadQuery = applyAgentClaimPoolFilter(leadQuery, auth.agentId)
    const { data: leadRows, error: leadErr } = await leadQuery
    if (leadErr) throw new Error(leadErr.message)
    const leadIds = (leadRows || []).map((r: { id: string }) => r.id)
    if (leadIds.length === 0) return NextResponse.json({ tasks: [] })

    const { data, error } = await supabase
      .from('lead_tasks')
      .select('id, lead_id, agent_id, due_at, type, status, created_at, leads ( id, name, phone )')
      .eq('status', 'pending')
      .in('lead_id', leadIds)
      .order('due_at', { ascending: true })
      .limit(500)

    if (error) throw new Error(error.message)

    const tasks = (data || []).map((row) => {
      const leadEmbed = (row as { leads?: unknown }).leads as
        | { name?: string; phone?: string }
        | { name?: string; phone?: string }[]
        | null
      const lead = Array.isArray(leadEmbed) ? leadEmbed[0] : leadEmbed
      return {
        id: (row as { id: string }).id,
        lead_id: (row as { lead_id: string }).lead_id,
        agent_id: (row as { agent_id: string | null }).agent_id,
        due_at: (row as { due_at: string }).due_at,
        type: (row as { type: string }).type,
        status: (row as { status: string }).status,
        created_at: (row as { created_at: string }).created_at,
        lead_name: lead?.name || 'Lead',
        lead_phone: lead?.phone || '',
      }
    })

    return NextResponse.json({ tasks })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
