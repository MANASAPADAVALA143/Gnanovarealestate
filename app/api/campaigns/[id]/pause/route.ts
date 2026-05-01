import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '../../../../../lib/supabase-service'

export const runtime = 'nodejs'

export async function POST(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const id = ctx.params.id
    const supabase = getSupabaseServiceClient()
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('outbound_campaigns')
      .update({ status: 'paused', updated_at: now })
      .eq('id', id)

    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Pause failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
