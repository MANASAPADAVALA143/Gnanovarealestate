/**
 * Detect whether the currently assigned broker has already done human work
 * on this lead — used to block Hot merit reassignment (Step C).
 *
 * Does NOT treat AI speed-to-lead signals (first_call_at / current VAPI id) as contact.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type HumanContactSignal =
  | 'whatsapp_agent_message'
  | 'agent_initiated_call'
  | 'agent_activity_log'

export async function brokerHasHumanContactedLead(
  supabase: SupabaseClient,
  params: {
    leadId: string
    agentId: string
    /** Exclude the in-flight speed-to-lead VAPI call from "agent call" detection */
    excludeVapiCallId?: string | null
  }
): Promise<{ contacted: boolean; signal?: HumanContactSignal }> {
  const { leadId, agentId, excludeVapiCallId } = params

  // 1) WhatsApp inbox: agent-sent message on a thread for this lead
  const { data: threads } = await supabase
    .from('whatsapp_threads')
    .select('id')
    .eq('lead_id', leadId)
    .limit(20)

  const threadIds = ((threads as { id: string }[]) || []).map((t) => t.id)
  if (threadIds.length > 0) {
    const { data: agentMsgs } = await supabase
      .from('whatsapp_thread_messages')
      .select('id')
      .in('thread_id', threadIds)
      .eq('sender_type', 'agent')
      .eq('sender_agent_id', agentId)
      .limit(1)
    if (agentMsgs && agentMsgs.length > 0) {
      return { contacted: true, signal: 'whatsapp_agent_message' }
    }
  }

  // 2) Calls logged to this agent+lead that are not the current speed-to-lead VAPI call
  const { data: calls } = await supabase
    .from('calls')
    .select('id, vapi_call_id')
    .eq('lead_id', leadId)
    .eq('agent_id', agentId)
    .limit(10)

  const callRows = (calls as { id: string; vapi_call_id?: string | null }[]) || []
  const nonSpeedCalls = callRows.filter(
    (c) => !excludeVapiCallId || c.vapi_call_id !== excludeVapiCallId
  )
  if (nonSpeedCalls.length > 0) {
    return { contacted: true, signal: 'agent_initiated_call' }
  }

  // 3) Non-system activity: created_by = this agent (auto capture notes leave created_by null)
  const { data: activities } = await supabase
    .from('lead_activities')
    .select('id')
    .eq('lead_id', leadId)
    .eq('created_by', agentId)
    .limit(1)

  if (activities && activities.length > 0) {
    return { contacted: true, signal: 'agent_activity_log' }
  }

  return { contacted: false }
}
