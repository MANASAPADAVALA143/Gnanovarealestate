import { NextRequest, NextResponse } from 'next/server'
import { normalizePhone } from '@/lib/bulk-import-helpers'
import { getSupabaseServiceClient } from '@/lib/supabase-service'
import { getWorkspaceById } from '@/lib/workspace-server'

export const runtime = 'nodejs'

/** Duplicate check for automations (n8n): GET /api/leads/lookup?phone=… with x-webhook-secret. */
export async function GET(req: NextRequest) {
  const expected = process.env.WEBHOOK_SECRET
  if (!expected) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 503 })
  }
  if (req.headers.get('x-webhook-secret') !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const phone = normalizePhone(new URL(req.url).searchParams.get('phone') || '')
  if (!phone || phone.length < 8) {
    return NextResponse.json({ error: 'A valid phone is required' }, { status: 400 })
  }

  try {
    const supabase = getSupabaseServiceClient()
    const { data, error } = await supabase
      .from('leads')
      .select('id, workspace_id, pipeline_stage')
      .eq('phone', phone)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return NextResponse.json({ exists: false, phone })

    const row = data as { id: string; workspace_id: string | null; pipeline_stage: string | null }
    const workspace = await getWorkspaceById(supabase, row.workspace_id)
    return NextResponse.json({
      exists: true,
      phone,
      leadId: row.id,
      workspace: workspace.slug,
      stage: row.pipeline_stage,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
