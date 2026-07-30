import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Request, Response } from 'express'

export const AD_SPEND_SOURCES = [
  'facebook',
  'instagram',
  'meta_ads',
  'property_finder',
  'bayut',
  'website',
  'referral',
  'walk_in',
] as const

export type AdSpendSource = (typeof AD_SPEND_SOURCES)[number]

function isAdSpendSource(v: string): v is AdSpendSource {
  return (AD_SPEND_SOURCES as readonly string[]).includes(v)
}

/** Map CRM lead.source values onto ad_spend source buckets. */
function sourceAliases(source: AdSpendSource): string[] {
  const base = [source, source.replace(/_/g, ' '), source.replace(/_/g, '-')]
  switch (source) {
    case 'facebook':
      return [...base, 'fb', 'facebook ads', 'meta', 'meta ads']
    case 'instagram':
      return [...base, 'ig', 'insta']
    case 'meta_ads':
      return [...base, 'meta', 'facebook', 'instagram', 'fb', 'ig']
    case 'property_finder':
      return [...base, 'propertyfinder', 'pf']
    case 'bayut':
      return [...base, 'bayut.com']
    case 'website':
      return [...base, 'web', 'site', 'organic']
    case 'referral':
      return [...base, 'referred']
    case 'walk_in':
      return [...base, 'walkin', 'walk-in', 'open house', 'open_house']
    default:
      return base
  }
}

function supabaseAnonUrlKey(): { url: string; key: string } | null {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL
  )?.trim()
  const key = (
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim()
  if (!url || !key) return null
  return { url, key }
}

async function resolveCaller(
  req: Request,
  service: SupabaseClient
): Promise<{ agentId: string; isManager: boolean } | null> {
  const header = (req.headers.authorization || req.headers.Authorization) as string | undefined
  const match = header?.match(/^Bearer\s+(.+)$/i)
  const token = match?.[1]?.trim()
  if (!token) return null

  const cfg = supabaseAnonUrlKey()
  if (!cfg) return null

  const anon = createClient(cfg.url, cfg.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await anon.auth.getUser(token)
  if (error || !data.user?.id) return null

  const { data: agent } = await service
    .from('agents')
    .select('id, is_manager, is_owner')
    .eq('id', data.user.id)
    .maybeSingle()

  if (!agent) return null
  const row = agent as { id: string; is_manager?: boolean; is_owner?: boolean }
  return {
    agentId: row.id,
    isManager: Boolean(row.is_manager) || Boolean(row.is_owner),
  }
}

async function countLeadsForPeriod(
  supabase: SupabaseClient,
  source: AdSpendSource,
  periodStart: string,
  periodEnd: string
): Promise<number> {
  const startIso = `${periodStart}T00:00:00.000Z`
  const endDate = new Date(`${periodEnd}T00:00:00.000Z`)
  endDate.setUTCDate(endDate.getUTCDate() + 1)
  const endIso = endDate.toISOString()

  const aliases = sourceAliases(source)
  const { data, error } = await supabase
    .from('leads')
    .select('id, source')
    .gte('created_at', startIso)
    .lt('created_at', endIso)

  if (error) {
    console.warn('[ad-spend] leads count failed:', error.message)
    return 0
  }

  const aliasSet = new Set(aliases.map((a) => a.toLowerCase()))
  let n = 0
  for (const row of data || []) {
    const src = String((row as { source?: string | null }).source || '')
      .toLowerCase()
      .trim()
    if (!src) continue
    if (aliasSet.has(src)) {
      n += 1
      continue
    }
    for (const a of aliasSet) {
      if (src.includes(a) || a.includes(src)) {
        n += 1
        break
      }
    }
  }
  return n
}

function enrichEntry(
  entry: Record<string, unknown>,
  leadCount: number
): Record<string, unknown> {
  const spend = Number(entry.spend_aed) || 0
  const costPerLead = leadCount > 0 ? Math.round((spend / leadCount) * 100) / 100 : null
  return {
    ...entry,
    lead_count: leadCount,
    cost_per_lead: costPerLead,
  }
}

export async function listAdSpendHandler(
  supabase: SupabaseClient,
  req: Request,
  res: Response
): Promise<void> {
  const caller = await resolveCaller(req, supabase)
  if (!caller) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const { data, error } = await supabase
    .from('ad_spend_entries')
    .select('*')
    .order('period_start', { ascending: false })

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  const entries = []
  for (const row of data || []) {
    const e = row as {
      source: AdSpendSource
      period_start: string
      period_end: string
      spend_aed: number
    }
    const leadCount = await countLeadsForPeriod(
      supabase,
      e.source,
      e.period_start,
      e.period_end
    )
    entries.push(enrichEntry(row as Record<string, unknown>, leadCount))
  }

  res.json({ entries })
}

export async function createAdSpendHandler(
  supabase: SupabaseClient,
  req: Request,
  res: Response
): Promise<void> {
  const caller = await resolveCaller(req, supabase)
  if (!caller) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  if (!caller.isManager) {
    res.status(403).json({ error: 'Manager or owner required' })
    return
  }

  const body = req.body || {}
  const period_start = String(body.period_start || '').slice(0, 10)
  const period_end = String(body.period_end || '').slice(0, 10)
  const source = String(body.source || '').trim()
  const campaign_name =
    typeof body.campaign_name === 'string' && body.campaign_name.trim()
      ? body.campaign_name.trim()
      : null
  const spend_aed = Number(body.spend_aed)

  if (!period_start || !period_end) {
    res.status(400).json({ error: 'period_start and period_end are required' })
    return
  }
  if (period_end < period_start) {
    res.status(400).json({ error: 'period_end must be on or after period_start' })
    return
  }
  if (!isAdSpendSource(source)) {
    res.status(400).json({ error: `source must be one of: ${AD_SPEND_SOURCES.join(', ')}` })
    return
  }
  if (!Number.isFinite(spend_aed) || spend_aed < 0) {
    res.status(400).json({ error: 'spend_aed must be a non-negative number' })
    return
  }

  const { data, error } = await supabase
    .from('ad_spend_entries')
    .insert({
      period_start,
      period_end,
      source,
      campaign_name,
      spend_aed,
      created_by: caller.agentId,
    })
    .select('*')
    .single()

  if (error || !data) {
    res.status(500).json({ error: error?.message || 'Insert failed' })
    return
  }

  const leadCount = await countLeadsForPeriod(supabase, source, period_start, period_end)
  res.status(201).json({ entry: enrichEntry(data as Record<string, unknown>, leadCount) })
}

export async function updateAdSpendHandler(
  supabase: SupabaseClient,
  req: Request,
  res: Response
): Promise<void> {
  const caller = await resolveCaller(req, supabase)
  if (!caller) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  if (!caller.isManager) {
    res.status(403).json({ error: 'Manager or owner required' })
    return
  }

  const id = req.params.id
  if (!id) {
    res.status(400).json({ error: 'Missing id' })
    return
  }

  const body = req.body || {}
  const patch: Record<string, unknown> = {}

  if (typeof body.spend_aed === 'number') {
    if (!Number.isFinite(body.spend_aed) || body.spend_aed < 0) {
      res.status(400).json({ error: 'spend_aed must be a non-negative number' })
      return
    }
    patch.spend_aed = body.spend_aed
  }
  if (typeof body.campaign_name === 'string') {
    patch.campaign_name = body.campaign_name.trim() || null
  }
  if (typeof body.period_start === 'string') patch.period_start = body.period_start.slice(0, 10)
  if (typeof body.period_end === 'string') patch.period_end = body.period_end.slice(0, 10)
  if (typeof body.source === 'string') {
    if (!isAdSpendSource(body.source)) {
      res.status(400).json({ error: 'Invalid source' })
      return
    }
    patch.source = body.source
  }

  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: 'No updatable fields provided' })
    return
  }

  const { data, error } = await supabase
    .from('ad_spend_entries')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  if (!data) {
    res.status(404).json({ error: 'Not found' })
    return
  }

  const row = data as {
    source: AdSpendSource
    period_start: string
    period_end: string
  }
  const leadCount = await countLeadsForPeriod(
    supabase,
    row.source,
    row.period_start,
    row.period_end
  )
  res.json({ entry: enrichEntry(data as Record<string, unknown>, leadCount) })
}

export async function deleteAdSpendHandler(
  supabase: SupabaseClient,
  req: Request,
  res: Response
): Promise<void> {
  const caller = await resolveCaller(req, supabase)
  if (!caller) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  if (!caller.isManager) {
    res.status(403).json({ error: 'Manager or owner required' })
    return
  }

  const id = req.params.id
  if (!id) {
    res.status(400).json({ error: 'Missing id' })
    return
  }

  const { error } = await supabase.from('ad_spend_entries').delete().eq('id', id)
  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  res.json({ ok: true })
}
