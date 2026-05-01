import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '../../../../lib/supabase-service'
import {
  fetchMatchingLeadIds,
  type CampaignFilters,
  type CampaignScoreFilter,
} from '../../../../lib/campaign-query'
import { toE164 } from '../../../../lib/phone-e164'
import {
  PRIYA_BRANCHING_SYSTEM_PROMPT,
  PRIYA_CAMPAIGN_FIRST_MESSAGE,
} from '../../../../lib/vapi-priya-branching-prompt'

export const runtime = 'nodejs'
export const maxDuration = 120

const BATCH = 500

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'http://localhost:3002'
  ).replace(/\/$/, '')
}

function parseBody(body: unknown): {
  name: string
  filters: CampaignFilters
  leadIds: string[]
} {
  if (!body || typeof body !== 'object') throw new Error('Invalid JSON body')
  const b = body as Record<string, unknown>
  const name = typeof b.name === 'string' ? b.name.trim() : ''
  if (!name) throw new Error('Campaign name is required')

  const filtersRaw = b.filters as Record<string, unknown> | undefined
  if (!filtersRaw || typeof filtersRaw !== 'object') throw new Error('filters object is required')

  const max = typeof filtersRaw.maxContacts === 'number' ? filtersRaw.maxContacts : Number(filtersRaw.maxContacts) || 500
  const scoreFilter = (filtersRaw.scoreFilter as CampaignScoreFilter) || 'all'
  const allowed: CampaignScoreFilter[] = ['all', 'unscored', 'hot', 'warm', 'cold']
  if (!allowed.includes(scoreFilter)) throw new Error('Invalid scoreFilter')

  const filters: CampaignFilters = {
    location: typeof filtersRaw.location === 'string' ? filtersRaw.location : '',
    scoreFilter,
    maxContacts: Math.min(Math.max(1, max), 100_000),
  }

  const leadIds = Array.isArray(b.leadIds)
    ? (b.leadIds as unknown[]).filter((x): x is string => typeof x === 'string' && x.length > 0)
    : []

  return { name, filters, leadIds }
}

async function startFirstVapiCall(params: {
  campaignLeadId: string
  leadName: string
  leadPhone: string
}): Promise<{ callId: string }> {
  const apiKey = process.env.VAPI_API_KEY || process.env.VITE_VAPI_API_KEY
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID || process.env.VITE_VAPI_PHONE_NUMBER_ID
  if (!apiKey) throw new Error('VAPI_API_KEY is not configured')
  if (!phoneNumberId) throw new Error('VAPI_PHONE_NUMBER_ID is not configured')

  const number = toE164(params.leadPhone)
  const serverUrl = `${appBaseUrl()}/api/vapi/outbound-webhook`

  const payload = {
    phoneNumberId,
    customer: {
      number: number,
      name: params.leadName || 'there',
    },
    assistant: {
      name: 'Priya',
      firstMessage: PRIYA_CAMPAIGN_FIRST_MESSAGE,
      model: {
        provider: 'openai',
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: PRIYA_BRANCHING_SYSTEM_PROMPT,
          },
        ],
      },
      voice: {
        provider: '11labs',
        voiceId: '21m00Tcm4TlvDq8ikWAM',
      },
      recordingEnabled: true,
      maxDurationSeconds: 240,
      serverUrl,
      metadata: {
        campaignLeadId: params.campaignLeadId,
      },
    },
  }

  const res = await fetch('https://api.vapi.ai/call/phone', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const data = (await res.json()) as { id?: string; message?: string }
  if (!res.ok) {
    throw new Error(data.message || `VAPI error (${res.status})`)
  }
  if (!data.id) throw new Error('VAPI did not return call id')
  return { callId: data.id }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, filters, leadIds: bodyLeadIds } = parseBody(body)
    const supabase = getSupabaseServiceClient()

    let leadIds =
      bodyLeadIds.length > 0 ? bodyLeadIds.slice(0, filters.maxContacts) : await fetchMatchingLeadIds(supabase, filters)

    leadIds = [...new Set(leadIds)]
    if (leadIds.length === 0) {
      return NextResponse.json({ error: 'No leads match these filters' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const { data: campaign, error: cErr } = await supabase
      .from('outbound_campaigns')
      .insert({
        name,
        status: 'running',
        started_at: now,
        updated_at: now,
        created_at: now,
        leads_count: leadIds.length,
        total_leads: leadIds.length,
        launch_filters: filters as unknown as Record<string, unknown>,
      })
      .select('id')
      .single()

    if (cErr || !campaign) {
      throw new Error(cErr?.message || 'Failed to create campaign')
    }

    const campaignId = campaign.id as string

    for (let i = 0; i < leadIds.length; i += BATCH) {
      const slice = leadIds.slice(i, i + BATCH).map((lead_id) => ({
        campaign_id: campaignId,
        lead_id,
        status: 'pending',
      }))
      const { error: insErr } = await supabase.from('campaign_leads').insert(slice)
      if (insErr) throw new Error(insErr.message)
    }

    const { data: firstRow, error: firstErr } = await supabase
      .from('campaign_leads')
      .select('id, lead_id')
      .eq('campaign_id', campaignId)
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (firstErr || !firstRow) {
      throw new Error(firstErr?.message || 'No campaign lead rows found')
    }

    const campaignLeadId = firstRow.id as string
    const { data: leadRow, error: leadErr } = await supabase
      .from('leads')
      .select('name, phone')
      .eq('id', firstRow.lead_id as string)
      .single()

    if (leadErr || !leadRow) {
      throw new Error(leadErr?.message || 'Lead not found for first call')
    }

    const leadJoin = leadRow as { name: string; phone: string }

    let vapiCallId: string | null = null
    try {
      const { callId } = await startFirstVapiCall({
        campaignLeadId,
        leadName: leadJoin.name,
        leadPhone: leadJoin.phone,
      })
      vapiCallId = callId
    } catch (vErr) {
      console.error('[launch] First VAPI call failed:', vErr)
      await supabase
        .from('campaign_leads')
        .update({
          status: 'failed',
          result: vErr instanceof Error ? vErr.message : 'VAPI failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', campaignLeadId)

      return NextResponse.json({
        campaignId,
        totalLeads: leadIds.length,
        warning: vErr instanceof Error ? vErr.message : 'First call failed',
      })
    }

    const { error: upErr } = await supabase
      .from('campaign_leads')
      .update({
        status: 'calling',
        vapi_call_id: vapiCallId,
        called_at: now,
        updated_at: now,
      })
      .eq('id', campaignLeadId)

    if (upErr) throw new Error(upErr.message)

    return NextResponse.json({
      campaignId,
      totalLeads: leadIds.length,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Launch failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
