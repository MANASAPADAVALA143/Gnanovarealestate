import { Router, type Request, type Response } from 'express'
import { getOpenHouseSupabase, triggerOpenHouseFollowUp } from '../lib/open-house-followup'

const router = Router()

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
