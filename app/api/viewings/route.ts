import { NextRequest, NextResponse } from 'next/server'
import { isAgentAuth, requireAgent } from '../../../lib/require-agent'
import { getSupabaseServiceClient } from '../../../lib/supabase-service'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAgent(req)
    if (!isAgentAuth(auth)) return auth
    const supabase = getSupabaseServiceClient()
    const { data, error } = await supabase
      .from('viewings')
      .select(
        'id, lead_id, property_id, agent_id, scheduled_at, status, interest_level, feedback, client_name, client_phone, leads ( name, phone ), properties ( title, address, city ), agents ( full_name )'
      )
      .eq('agent_id', auth.agentId)
      .order('scheduled_at', { ascending: true })
      .limit(300)
    if (error) throw new Error(error.message)
    return NextResponse.json({ viewings: data || [] })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAgent(req)
    if (!isAgentAuth(auth)) return auth
    const body = (await req.json()) as {
      property_id?: string
      scheduled_at?: string
      lead_id?: string
      client_name?: string
      client_phone?: string
    }
    if (!body.property_id || !body.scheduled_at) {
      return NextResponse.json({ error: 'property_id and scheduled_at required' }, { status: 400 })
    }
    const scheduledAt = new Date(body.scheduled_at)
    if (Number.isNaN(scheduledAt.getTime())) {
      return NextResponse.json({ error: 'Invalid scheduled_at' }, { status: 400 })
    }
    const supabase = getSupabaseServiceClient()
    const { data, error } = await supabase
      .from('viewings')
      .insert({
        property_id: body.property_id,
        scheduled_at: scheduledAt.toISOString(),
        lead_id: body.lead_id || null,
        client_name: body.client_name || null,
        client_phone: body.client_phone || null,
        agent_id: auth.agentId,
        status: 'scheduled',
      })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ viewing: data }, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
