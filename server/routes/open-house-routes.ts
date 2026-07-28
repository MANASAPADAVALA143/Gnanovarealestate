import { Router, type Request, type Response } from 'express'
import { getOpenHouseSupabase, triggerOpenHouseFollowUp } from '../lib/open-house-followup'
import { logConsentToDb } from '../../src/lib/consent.ts'

const router = Router()

/** Public event metadata for the guest check-in page (no auth). */
router.get('/:eventId', async (req: Request, res: Response) => {
  try {
    const eventId = req.params.eventId
    const supabase = getOpenHouseSupabase()

    const { data: event, error } = await supabase
      .from('open_house_events')
      .select('id, address, agent_id, scheduled_at, ends_at, status')
      .eq('id', eventId)
      .single()

    if (error) {
      // PGRST116 = no rows; anything else is a real failure (e.g. missing table)
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Event not found' })
      }
      console.error('[open-house-routes] get event query error', error)
      return res.status(500).json({
        error: error.message,
        code: error.code,
        hint: 'Ensure supabase/migrations/016_open_house_events.sql is applied',
      })
    }
    if (!event) {
      return res.status(404).json({ error: 'Event not found' })
    }

    return res.json({ event })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error'
    console.error('[open-house-routes] get event', e)
    return res.status(500).json({ error: msg })
  }
})

router.post('/:eventId/attendees', async (req: Request, res: Response) => {
  try {
    const eventId = req.params.eventId
    const { name, phone, email, consent_given } = req.body as {
      name?: string
      phone?: string
      email?: string
      consent_given?: boolean
    }

    if (!name?.trim() || !phone?.trim()) {
      return res.status(400).json({ error: 'Name and phone are required' })
    }
    if (!consent_given) {
      return res.status(400).json({ error: 'Privacy consent is required before check-in' })
    }

    const supabase = getOpenHouseSupabase()

    const { data: event, error: evErr } = await supabase
      .from('open_house_events')
      .select('id')
      .eq('id', eventId)
      .single()

    if (evErr) {
      if (evErr.code === 'PGRST116') {
        return res.status(404).json({ error: 'Event not found' })
      }
      console.error('[open-house-routes] check-in event lookup', evErr)
      return res.status(500).json({
        error: evErr.message,
        code: evErr.code,
        hint: 'Ensure supabase/migrations/016_open_house_events.sql is applied',
      })
    }
    if (!event) {
      return res.status(404).json({ error: 'Event not found' })
    }

    const { data: attendee, error: insErr } = await supabase
      .from('open_house_attendees')
      .insert({
        open_house_id: eventId,
        name: name.trim(),
        phone: phone.trim(),
        email: email?.trim() || null,
      })
      .select('id')
      .single()

    if (insErr) {
      const msg = insErr.message.includes('duplicate')
        ? 'This phone is already checked in for this event.'
        : insErr.message
      return res.status(400).json({ error: msg })
    }

    await logConsentToDb(supabase, {
      lead_id: attendee.id,
      phone: phone.trim(),
      email: email?.trim() || undefined,
      context: 'openhouse',
    })

    return res.json({ success: true, attendee_id: attendee.id })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error'
    console.error('[open-house-routes] check-in', e)
    return res.status(500).json({ error: msg })
  }
})

router.post('/trigger-followups', async (req: Request, res: Response) => {
  try {
    const open_house_id = req.body?.open_house_id as string | undefined
    if (!open_house_id) {
      return res.status(400).json({ error: 'open_house_id required' })
    }

    const supabase = getOpenHouseSupabase()

    const { data: event, error: evErr } = await supabase
      .from('open_house_events')
      .select('id, address, agent_id')
      .eq('id', open_house_id)
      .single()

    if (evErr || !event) {
      return res.status(404).json({ error: 'Event not found' })
    }

    const ev = event as { id: string; address: string; agent_id: string | null }

    const { data: attendees, error: attErr } = await supabase
      .from('open_house_attendees')
      .select('id, name, phone, lead_id')
      .eq('open_house_id', open_house_id)
      .eq('follow_up_status', 'pending')

    if (attErr) {
      return res.status(500).json({ error: attErr.message })
    }
    if (!attendees?.length) {
      return res.json({ triggered: 0, total: 0, message: 'No pending attendees' })
    }

    const results = await Promise.allSettled(
      attendees.map((row) =>
        triggerOpenHouseFollowUp({
          attendeeId: (row as { id: string }).id,
          openHouseId: ev.id,
          address: ev.address,
          agentId: ev.agent_id,
          name: (row as { name: string }).name,
          phone: (row as { phone: string }).phone,
          leadId: (row as { lead_id: string | null }).lead_id,
        })
      )
    )

    const triggered = results.filter(
      (r) => r.status === 'fulfilled' && r.value.success
    ).length

    return res.json({ triggered, total: attendees.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error'
    console.error('[open-house-routes]', e)
    return res.status(500).json({ error: msg })
  }
})

export default router
