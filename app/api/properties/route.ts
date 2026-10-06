import { NextRequest, NextResponse } from 'next/server'
import { isAgentAuth, requireAgent } from '../../../lib/require-agent'
import { getSupabaseServiceClient } from '../../../lib/supabase-service'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAgent(req)
    if (!isAgentAuth(auth)) return auth

    const limit = Math.min(500, Math.max(1, Number(new URL(req.url).searchParams.get('limit') ?? 100)))
    const supabase = getSupabaseServiceClient()

    let query = supabase
      .from('properties')
      .select('id, title, address, city, price, bedrooms, property_type, status')
      .order('created_at', { ascending: false })
      .limit(limit)

    query = query.eq('status', 'active')

    const { data, error } = await query
    if (error) {
      const fallback = await supabase
        .from('properties')
        .select('id, title, address, city, price, bedrooms, property_type, status')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (fallback.error) return NextResponse.json({ error: fallback.error.message }, { status: 400 })
      return NextResponse.json({ properties: fallback.data || [] })
    }

    return NextResponse.json({ properties: data || [] })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
