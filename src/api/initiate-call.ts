import { supabase } from '../lib/supabase'
import { vapiClient } from '../lib/vapi-client'

export async function initiateCall(
  leadPhone: string,
  leadName: string,
  agentId: string,
  leadSource: string = 'website'
) {
  try {
    // Get agent details
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('full_name')
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      throw new Error('Agent not found')
    }

    // Initiate call via VAPI
    const call = await vapiClient.initiateCall({
      phoneNumber: leadPhone,
      agentName: agent.full_name,
      agentId,
    })

    // Log call attempt
    await supabase.from('call_attempts').insert({
      agent_id: agentId,
      lead_phone: leadPhone,
      status: 'initiated',
      vapi_call_id: call.id,
    })

    console.log('Call initiated:', call.id)
    return { success: true, callId: call.id }
  } catch (error) {
    console.error('Error initiating call:', error)
    throw error
  }
}







