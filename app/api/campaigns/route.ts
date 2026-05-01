import { NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '../../../lib/supabase-service'

export const runtime = 'nodejs'

export type CampaignListRow = {
  id: string
  name: string
  status: string | null
  created_at: string | null
  started_at: string | null
  leads_count: number | null
  total_leads: number | null
  calls_made: number | null
  calls_completed: number | null
  calls_connected: number | null
  scored_count: number
}

export async function GET() {
  try {
    const supabase = getSupabaseServiceClient()
    const { data: campaigns, error } = await supabase
      .from('outbound_campaigns')
      .select(
        'id,name,status,created_at,started_at,leads_count,total_leads,calls_made,calls_completed,calls_connected'
      )
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)

    const rows: CampaignListRow[] = []
    for (const c of campaigns || []) {
      const row = c as Omit<CampaignListRow, 'scored_count'>
      const { count } = await supabase
        .from('campaign_leads')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', row.id)
        .not('lead_score', 'is', null)

      rows.push({
        ...row,
        scored_count: count ?? 0,
      })
    }

    return NextResponse.json({ campaigns: rows })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to list campaigns'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
