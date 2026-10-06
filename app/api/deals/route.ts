import { NextRequest, NextResponse } from 'next/server'
import { isDealStage } from '../../../lib/pipeline'
import { isAgentAuth, requireAgent } from '../../../lib/require-agent'
import { getSupabaseServiceClient } from '../../../lib/supabase-service'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAgent(req)
    if (!isAgentAuth(auth)) return auth
    const supabase = getSupabaseServiceClient()
    const { data, error } = await supabase
      .from('deals')
      .select(
        'id, lead_id, agent_id, client_name, stage, unit_number, project_name, sale_value, commission_percent, agent_commission, brokerage_commission, expected_close_date, actual_close_date, created_at, leads ( name, phone ), agents ( full_name )'
      )
      .eq('agent_id', auth.agentId)
      .order('created_at', { ascending: false })
      .limit(300)
    if (error) throw new Error(error.message)
    return NextResponse.json({ deals: data || [] })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAgent(req)
    if (!isAgentAuth(auth)) return auth
    const body = (await req.json()) as Record<string, unknown>
    const sale = body.sale_value != null ? Number(body.sale_value) : null
    const pct = body.commission_percent != null ? Number(body.commission_percent) : null
    const total = sale != null && pct != null ? (sale * pct) / 100 : null
    const insert = {
      lead_id: (body.lead_id as string) || null,
      client_name: (body.client_name as string) || null,
      stage: isDealStage(String(body.stage || '')) ? body.stage : 'viewing',
      unit_number: (body.unit_number as string) || null,
      project_name: (body.project_name as string) || null,
      sale_value: sale,
      commission_percent: pct,
      agent_commission: total != null ? total / 2 : null,
      brokerage_commission: total != null ? total / 2 : null,
      expected_close_date: (body.expected_close_date as string) || null,
      agent_id: auth.agentId,
    }
    if (!insert.lead_id && !insert.client_name) {
      return NextResponse.json({ error: 'lead_id or client_name required' }, { status: 400 })
    }
    const supabase = getSupabaseServiceClient()
    const { data, error } = await supabase.from('deals').insert(insert).select('*').single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ deal: data }, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
