import { getOpenHouseSupabase, triggerOpenHouseFollowUp } from './open-house-followup'

export async function runOpenHouseScheduler(): Promise<void> {
  let supabase
  try {
    supabase = getOpenHouseSupabase()
  } catch {
    return
  }

  const now = new Date().toISOString()

  const { data: events, error } = await supabase
    .from('open_house_events')
    .select('id, address, agent_id')
    .in('status', ['upcoming', 'active'])
    .lte('ends_at', now)

  if (error) {
    console.error('[open-house-scheduler] query failed:', error.message)
    return
  }
  if (!events?.length) return

  for (const event of events) {
    const ev = event as { id: string; address: string; agent_id: string | null }

    const { error: upErr } = await supabase.from('open_house_events').update({ status: 'completed' }).eq('id', ev.id)
    if (upErr) {
      console.error('[open-house-scheduler] failed to complete event', ev.id, upErr.message)
      continue
    }

    const { data: attendees } = await supabase
      .from('open_house_attendees')
      .select('id, name, phone, lead_id')
      .eq('open_house_id', ev.id)
      .eq('follow_up_status', 'pending')

    if (!attendees?.length) continue

    for (const row of attendees) {
      const a = row as { id: string; name: string; phone: string; lead_id: string | null }
      try {
        await triggerOpenHouseFollowUp({
          attendeeId: a.id,
          openHouseId: ev.id,
          address: ev.address,
          agentId: ev.agent_id,
          name: a.name,
          phone: a.phone,
          leadId: a.lead_id,
        })
      } catch (e) {
        console.error('[open-house-scheduler] follow-up error', a.id, e)
      }
    }
  }
}
