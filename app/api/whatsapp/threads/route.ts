import { NextRequest, NextResponse } from 'next/server'
import { isAgentAuth, requireAgent } from '@/lib/require-agent'
import { getSupabaseServiceClient } from '@/lib/supabase-service'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAgent(req)
    if (!isAgentAuth(auth)) return auth

    const status = (new URL(req.url).searchParams.get('status') || '').trim()
    const supabase = getSupabaseServiceClient()
    let q = supabase
      .from('whatsapp_threads')
      .select(
        'id, lead_id, phone_number, assigned_agent_id, status, last_message_at, last_message_preview, unread_count, created_at, leads ( name, phone )'
      )
      .or(`assigned_agent_id.eq.${auth.agentId},assigned_agent_id.is.null`)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(200)

    if (status && status !== 'all') q = q.eq('status', status)

    const { data, error } = await q
    if (error) throw new Error(error.message)

    const threads = (data || []).map((row) => {
      const leadEmbed = (row as { leads?: unknown }).leads as { name?: string } | { name?: string }[] | null
      const lead = Array.isArray(leadEmbed) ? leadEmbed[0] : leadEmbed
      return {
        ...(row as Record<string, unknown>),
        contact_name: lead?.name || (row as { phone_number: string }).phone_number,
      }
    })

    return NextResponse.json({ threads })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
