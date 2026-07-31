import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Request, Response } from 'express'

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

function requireManager(
  caller: { isManager: boolean } | null,
  res: Response
): boolean {
  if (!caller) {
    res.status(401).json({ error: 'Unauthorized' })
    return false
  }
  if (!caller.isManager) {
    res.status(403).json({ error: 'Manager or owner required' })
    return false
  }
  return true
}

export async function listPaymentPlanHandler(
  supabase: SupabaseClient,
  req: Request,
  res: Response
): Promise<void> {
  const propertyId = String(req.params.propertyId || '')
  if (!propertyId) {
    res.status(400).json({ error: 'propertyId required' })
    return
  }

  const { data, error } = await supabase
    .from('property_payment_plans')
    .select('*')
    .eq('property_id', propertyId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  res.json({ milestones: data || [] })
}

export async function createPaymentPlanMilestoneHandler(
  supabase: SupabaseClient,
  req: Request,
  res: Response
): Promise<void> {
  const caller = await resolveCaller(req, supabase)
  if (!requireManager(caller, res)) return

  const propertyId = String(req.params.propertyId || '')
  const body = req.body || {}
  const milestone = String(body.milestone || '').trim()
  const percentage = Number(body.percentage)

  if (!propertyId || !milestone) {
    res.status(400).json({ error: 'milestone required' })
    return
  }
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    res.status(400).json({ error: 'percentage must be 0–100' })
    return
  }

  let sortOrder = body.sort_order != null ? Number(body.sort_order) : NaN
  if (!Number.isFinite(sortOrder)) {
    const { data: existing } = await supabase
      .from('property_payment_plans')
      .select('sort_order')
      .eq('property_id', propertyId)
      .order('sort_order', { ascending: false })
      .limit(1)
    sortOrder = existing?.[0] ? Number(existing[0].sort_order) + 1 : 0
  }

  const { data, error } = await supabase
    .from('property_payment_plans')
    .insert({
      property_id: propertyId,
      milestone,
      percentage,
      due_date: body.due_date != null ? String(body.due_date).trim() || null : null,
      notes: body.notes != null ? String(body.notes).trim() || null : null,
      sort_order: sortOrder,
    })
    .select()
    .single()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  res.status(201).json({ milestone: data })
}

export async function updatePaymentPlanMilestoneHandler(
  supabase: SupabaseClient,
  req: Request,
  res: Response
): Promise<void> {
  const caller = await resolveCaller(req, supabase)
  if (!requireManager(caller, res)) return

  const propertyId = String(req.params.propertyId || '')
  const id = String(req.params.id || '')
  const body = req.body || {}

  if (!propertyId || !id) {
    res.status(400).json({ error: 'propertyId and id required' })
    return
  }

  const patch: Record<string, unknown> = {}
  if (body.milestone != null) patch.milestone = String(body.milestone).trim()
  if (body.percentage != null) {
    const percentage = Number(body.percentage)
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      res.status(400).json({ error: 'percentage must be 0–100' })
      return
    }
    patch.percentage = percentage
  }
  if (body.due_date !== undefined) {
    patch.due_date = body.due_date != null ? String(body.due_date).trim() || null : null
  }
  if (body.notes !== undefined) {
    patch.notes = body.notes != null ? String(body.notes).trim() || null : null
  }
  if (body.sort_order != null) patch.sort_order = Number(body.sort_order)

  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: 'No fields to update' })
    return
  }

  const { data, error } = await supabase
    .from('property_payment_plans')
    .update(patch)
    .eq('id', id)
    .eq('property_id', propertyId)
    .select()
    .single()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  if (!data) {
    res.status(404).json({ error: 'Milestone not found' })
    return
  }

  res.json({ milestone: data })
}

export async function deletePaymentPlanMilestoneHandler(
  supabase: SupabaseClient,
  req: Request,
  res: Response
): Promise<void> {
  const caller = await resolveCaller(req, supabase)
  if (!requireManager(caller, res)) return

  const propertyId = String(req.params.propertyId || '')
  const id = String(req.params.id || '')

  if (!propertyId || !id) {
    res.status(400).json({ error: 'propertyId and id required' })
    return
  }

  const { error } = await supabase
    .from('property_payment_plans')
    .delete()
    .eq('id', id)
    .eq('property_id', propertyId)

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  res.json({ success: true })
}

/** Batch teaser: first 3 percentages per property for card display */
export async function listPaymentPlanTeasersHandler(
  supabase: SupabaseClient,
  req: Request,
  res: Response
): Promise<void> {
  const idsRaw = String(req.query.propertyIds || '')
  const ids = idsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100)

  if (ids.length === 0) {
    res.json({ teasers: {} as Record<string, string> })
    return
  }

  const { data, error } = await supabase
    .from('property_payment_plans')
    .select('property_id, percentage, sort_order')
    .in('property_id', ids)
    .order('sort_order', { ascending: true })

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  const byProp = new Map<string, number[]>()
  for (const row of data || []) {
    const pid = String((row as { property_id: string }).property_id)
    const pct = Number((row as { percentage: number }).percentage)
    const list = byProp.get(pid) || []
    if (list.length < 3) list.push(pct)
    byProp.set(pid, list)
  }

  const teasers: Record<string, string> = {}
  for (const [pid, pcts] of byProp) {
    if (pcts.length > 0) {
      teasers[pid] = pcts.map((p) => String(Math.round(p))).join('/')
    }
  }

  res.json({ teasers })
}
