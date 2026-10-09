import { NextRequest, NextResponse } from 'next/server'
import { findAccessibleLead } from '@/lib/lead-access'
import { isAgentAuth, requireAgent } from '@/lib/require-agent'
import { getSupabaseServiceClient } from '@/lib/supabase-service'

export const runtime = 'nodejs'

const ACTIVITY_TYPES = new Set(['call', 'whatsapp', 'email', 'note', 'stage_change', 'viewing', 'task'])

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
      .from('lead_activities')
      .select('id, lead_id, type, content, created_at, created_by')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) throw new Error(error.message)
    return NextResponse.json({ activities: data || [] })
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
    const body = (await req.json()) as { type?: string; content?: string }
    const type = (body.type || 'note').trim()
    const content = (body.content || '').trim()
    if (!ACTIVITY_TYPES.has(type)) {
      return NextResponse.json({ error: 'Invalid activity type' }, { status: 400 })
    }
    if (!content) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 })
    }

    const supabase = getSupabaseServiceClient()
    const lead = await findAccessibleLead(supabase, leadId, auth.agentId, 'id')
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    const { data, error } = await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        type,
        content,
        created_by: auth.agentId,
      })
      .select('id, lead_id, type, content, created_at, created_by')
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ activity: data }, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
