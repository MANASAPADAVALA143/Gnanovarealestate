import { NextRequest, NextResponse } from 'next/server'
import { isAgentAuth, requireAgent } from '../../../../lib/require-agent'
import { getSupabaseServiceClient } from '../../../../lib/supabase-service'
import {
  countMatchingLeads,
  previewMatchingLeads,
  type CampaignFilters,
  type CampaignScoreFilter,
} from '../../../../lib/campaign-query'

export const runtime = 'nodejs'

function parseFilters(body: unknown): CampaignFilters {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid body')
  }
  const b = body as Record<string, unknown>
  const max = typeof b.maxContacts === 'number' ? b.maxContacts : Number(b.maxContacts) || 500
  const scoreFilter = (b.scoreFilter as CampaignScoreFilter) || 'all'
  const allowed: CampaignScoreFilter[] = ['all', 'unscored', 'hot', 'warm', 'cold']
  if (!allowed.includes(scoreFilter)) {
    throw new Error('Invalid scoreFilter')
  }
  return {
    location: typeof b.location === 'string' ? b.location : '',
    scoreFilter,
    maxContacts: Math.min(Math.max(1, max), 100_000),
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAgent(req)
    if (!isAgentAuth(auth)) return auth

    const body = await req.json()
    const filters = parseFilters(body)
    const supabase = getSupabaseServiceClient()
    const [count, leads] = await Promise.all([
      countMatchingLeads(supabase, filters, auth.agentId),
      previewMatchingLeads(supabase, filters, 50, auth.agentId),
    ])
    return NextResponse.json({ count, leads })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Preview failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
