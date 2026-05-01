import { NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '../../../../lib/supabase-service'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const supabase = getSupabaseServiceClient()
    const { data, error } = await supabase
      .from('leads')
      .select('location')
      .not('location', 'is', null)
      .neq('location', '')
      .limit(5000)

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
