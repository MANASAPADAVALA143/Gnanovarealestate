import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '../../../../lib/supabase-service'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { leadId?: string }
    const leadId = typeof body.leadId === 'string' ? body.leadId.trim() : ''
    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 })
    }

    const supabase = getSupabaseServiceClient()
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('leads')
      .update({
        manual_call_done: true,
        manual_called_at: now,
        updated_at: now,
      })
      .eq('id', leadId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
