import { NextRequest, NextResponse } from 'next/server'
import { isAgentAuth, requireAgent } from '../../../../../lib/require-agent'
import { getSupabaseServiceClient } from '../../../../../lib/supabase-service'

export const runtime = 'nodejs'

function toCsv(rows: { name: string; phone: string; email: string; location: string; score: number }[]) {
  const header = 'name,phone,email,location,lead_score\n'
  const body = rows
    .map((r) =>
      [r.name, r.phone, r.email, r.location, String(r.score)]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(',')
    )
    .join('\n')
  return header + body
}

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const auth = await requireAgent(req)
    if (!isAgentAuth(auth)) return auth

    const id = ctx.params.id
    const supabase = getSupabaseServiceClient()

    const { data: campaign, error: campErr } = await supabase
      .from('outbound_campaigns')
      .select('id')
      .eq('id', id)
      .eq('agent_id', auth.agentId)
      .maybeSingle()

    if (campErr) throw new Error(campErr.message)
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const { data: clRows, error } = await supabase
      .from('campaign_leads')
      .select('lead_id, lead_score')
      .eq('campaign_id', id)
      .gte('lead_score', 80)

    if (error) throw new Error(error.message)

    const hot = (clRows || []).filter((r) => typeof r.lead_score === 'number' && r.lead_score >= 80)
    const leadIds = [...new Set(hot.map((r) => r.lead_id as string))]
    if (!leadIds.length) {
      const csv = toCsv([])
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="hot-leads-${id.slice(0, 8)}.csv"`,
        },
      })
    }

    const { data: leads, error: lErr } = await supabase
      .from('leads')
      .select('id,name,phone,email,location')
      .in('id', leadIds)

    if (lErr) throw new Error(lErr.message)

    const scoreByLead = new Map(hot.map((r) => [r.lead_id as string, r.lead_score as number]))
    const out: { name: string; phone: string; email: string; location: string; score: number }[] = []
    for (const L of leads || []) {
      const lid = L.id as string
      const sc = scoreByLead.get(lid)
      if (typeof sc !== 'number') continue
      out.push({
        name: (L.name as string) || '',
        phone: (L.phone as string) || '',
        email: (L.email as string | null) || '',
        location: (L.location as string | null) || '',
        score: sc,
      })
    }

    const csv = toCsv(out)
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="hot-leads-${id.slice(0, 8)}.csv"`,
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Export failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
