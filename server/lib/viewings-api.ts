import type { Request, Response } from 'express'
import type { SupabaseClient } from '@supabase/supabase-js'

export const VIEWING_STATUSES = [
  'scheduled',
  'confirmed',
  'completed',
  'no_show',
  'cancelled',
] as const

export type ViewingStatus = (typeof VIEWING_STATUSES)[number]

export const VIEWING_INTEREST_LEVELS = ['low', 'medium', 'high'] as const
export type ViewingInterestLevel = (typeof VIEWING_INTEREST_LEVELS)[number]

const VIEWING_SELECT = `
  *,
  leads ( id, name, phone ),
  deals ( id, client_name, stage ),
  properties ( id, address, city, state ),
  agents ( id, full_name )
`

function isViewingStatus(value: string): value is ViewingStatus {
  return (VIEWING_STATUSES as readonly string[]).includes(value)
}

function isInterestLevel(value: string): value is ViewingInterestLevel {
  return (VIEWING_INTEREST_LEVELS as readonly string[]).includes(value)
}

function startOfTodayIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function endOfDayIso(date: Date): string {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
}

function parseScheduledAt(value: unknown): string | null {
  if (value == null || value === '') return null
  const d = new Date(String(value))
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

export async function createViewingHandler(
  supabase: SupabaseClient,
  req: Request,
  res: Response
): Promise<void> {
  try {
    const body = req.body || {}
    const propertyId = body.property_id
    const agentId = body.agent_id
    const scheduledAt = parseScheduledAt(body.scheduled_at)
    const leadId = body.lead_id || null
    const clientName = body.client_name?.trim() || null

    if (!propertyId) {
      res.status(400).json({ error: 'property_id is required' })
      return
    }
    if (!agentId) {
      res.status(400).json({ error: 'agent_id is required' })
      return
    }
    if (!scheduledAt) {
      res.status(400).json({ error: 'scheduled_at is required (ISO datetime)' })
      return
    }
    if (!leadId && !clientName) {
      res.status(400).json({ error: 'lead_id or client_name is required' })
      return
    }

    if (body.status && !isViewingStatus(body.status)) {
      res.status(400).json({ error: 'Invalid status' })
      return
    }
    if (body.interest_level && !isInterestLevel(body.interest_level)) {
      res.status(400).json({ error: 'Invalid interest_level' })
      return
    }

    const row = {
      lead_id: leadId,
      deal_id: body.deal_id || null,
      property_id: propertyId,
      agent_id: agentId,
      scheduled_at: scheduledAt,
      status: body.status || 'scheduled',
      client_name: clientName,
      client_phone: body.client_phone?.trim() || null,
      feedback: body.feedback?.trim() || null,
      interest_level: body.interest_level || null,
    }

    const { data, error } = await supabase
      .from('viewings')
      .insert(row as never)
      .select(VIEWING_SELECT)
      .single()

    if (error) {
      console.error('[viewings] create error:', error)
      res.status(500).json({ error: error.message })
      return
    }

    res.status(201).json({ viewing: data })
  } catch (e) {
    console.error('[viewings] create failed:', e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'Internal server error' })
  }
}

export async function listViewingsHandler(
  supabase: SupabaseClient,
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { agent_id, status, property_id, from, to, lead_id } = req.query

    let q = supabase
      .from('viewings')
      .select(VIEWING_SELECT)
      .order('scheduled_at', { ascending: true })

    if (typeof agent_id === 'string' && agent_id) {
      q = q.eq('agent_id', agent_id)
    }
    if (typeof status === 'string' && status) {
      if (!isViewingStatus(status)) {
        res.status(400).json({ error: 'Invalid status filter' })
        return
      }
      q = q.eq('status', status)
    }
    if (typeof property_id === 'string' && property_id) {
      q = q.eq('property_id', property_id)
    }
    if (typeof lead_id === 'string' && lead_id) {
      q = q.eq('lead_id', lead_id)
    }
    if (typeof from === 'string' && from) {
      q = q.gte('scheduled_at', from)
    }
    if (typeof to === 'string' && to) {
      q = q.lte('scheduled_at', to)
    }

    const { data, error } = await q
    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.json({ viewings: data || [] })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Internal server error' })
  }
}

export async function upcomingViewingsHandler(
  supabase: SupabaseClient,
  req: Request,
  res: Response
): Promise<void> {
  try {
    const agentId = typeof req.query.agent_id === 'string' ? req.query.agent_id : undefined
    const fromIso = startOfTodayIso()
    const end = new Date()
    end.setDate(end.getDate() + 7)
    const toIso = endOfDayIso(end)

    let q = supabase
      .from('viewings')
      .select(VIEWING_SELECT)
      .gte('scheduled_at', fromIso)
      .lte('scheduled_at', toIso)
      .neq('status', 'cancelled')
      .order('scheduled_at', { ascending: true })

    if (agentId) {
      q = q.eq('agent_id', agentId)
    }

    const { data, error } = await q
    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    const viewings = data || []
    const todayKey = fromIso.slice(0, 10)
    const today = viewings.filter((v) => String(v.scheduled_at).slice(0, 10) === todayKey)

    res.json({
      from: fromIso,
      to: toIso,
      today_count: today.length,
      viewings,
    })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Internal server error' })
  }
}

export async function updateViewingHandler(
  supabase: SupabaseClient,
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params
    const body = req.body || {}

    const { data: existing, error: fetchError } = await supabase
      .from('viewings')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) {
      res.status(500).json({ error: fetchError.message })
      return
    }
    if (!existing) {
      res.status(404).json({ error: 'Viewing not found' })
      return
    }

    const patch: Record<string, unknown> = {}

    if (body.status !== undefined) {
      if (!isViewingStatus(body.status)) {
        res.status(400).json({ error: 'Invalid status' })
        return
      }
      patch.status = body.status
    }

    if (body.interest_level !== undefined) {
      if (body.interest_level !== null && !isInterestLevel(body.interest_level)) {
        res.status(400).json({ error: 'Invalid interest_level' })
        return
      }
      patch.interest_level = body.interest_level
    }

    if (body.feedback !== undefined) {
      patch.feedback = body.feedback?.trim() || null
    }

    if (body.scheduled_at !== undefined) {
      const parsed = parseScheduledAt(body.scheduled_at)
      if (!parsed) {
        res.status(400).json({ error: 'Invalid scheduled_at' })
        return
      }
      patch.scheduled_at = parsed
    }

    const scalarFields = ['lead_id', 'deal_id', 'property_id', 'agent_id', 'client_name', 'client_phone'] as const
    for (const key of scalarFields) {
      if (body[key] !== undefined) patch[key] = body[key]
    }

    const nextLeadId = patch.lead_id !== undefined ? patch.lead_id : existing.lead_id
    const nextClientName =
      patch.client_name !== undefined ? patch.client_name : existing.client_name
    if (!nextLeadId && (!nextClientName || !String(nextClientName).trim())) {
      res.status(400).json({ error: 'lead_id or client_name is required' })
      return
    }

    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: 'No fields to update' })
      return
    }

    const { data, error } = await supabase
      .from('viewings')
      .update(patch as never)
      .eq('id', id)
      .select(VIEWING_SELECT)
      .single()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.json({ viewing: data })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Internal server error' })
  }
}
