/**
 * VAPI Inbound Receptionist
 * 
 * Handles incoming calls to the agent's VAPI phone number
 * - Sarah answers automatically
 * - Qualifies the lead
 * - Searches properties using RAG
 * - Books appointments
 * - Saves to database as inbound lead
 */

import { supabase } from '../lib/supabase'
import { mapVapiToCallOutcome } from '../lib/call-outcome'
import { syncToGoHighLevel } from '../lib/gohighlevel'
import { resolveVapiAgentId } from '../lib/vapi-resolve-agent'

export interface InboundCallData {
  callId: string
  phoneNumber: string
  timestamp: string
  customerNumber?: string
  metadata?: any
}

/**
 * Handle inbound VAPI call webhook
 * This is called when someone calls the agent's VAPI number
 */
export async function handleVapiInboundCall(payload: any): Promise<{
  success: boolean
  callId?: string
  error?: string
}> {
  try {
    console.log('📞 Received inbound VAPI call')

    const {
      call,
      message,
      phoneNumber,
      customer,
    } = payload

    const callId = call?.id || payload.id
    const customerPhone = customer?.number || phoneNumber || payload.phoneNumber

    if (!customerPhone) {
      throw new Error('No phone number provided in inbound call')
    }

    console.log('📱 Inbound call from:', customerPhone)

    const resolvedAgentId = resolveVapiAgentId({ call, metadata: payload.metadata })
    if (resolvedAgentId) {
      console.log('🧑‍💼 Inbound call assigned to agent:', resolvedAgentId)
    } else {
      console.warn(
        '⚠️ No agent id for inbound call — set DEFAULT_AGENT_ID or VITE_DEFAULT_AGENT_ID in .env (webhook server) so Leads/Calls show this row.'
      )
    }

    // Check if this lead already exists by phone number
    const { data: existingLead, error: searchError } = await supabase
      .from('leads')
      .select('*')
      .eq('phone', customerPhone)
      .maybeSingle()

    if (searchError) {
      console.error('Lead lookup error:', searchError)
      throw new Error(`Lead lookup failed: ${searchError.message}`)
    }

    let leadId: string

    if (existingLead) {
      // Lead exists - update
      console.log('📝 Existing lead found:', existingLead.id)
      leadId = existingLead.id

      // Update lead status if it's cold
      if (existingLead.status === 'cold') {
        await supabase
          .from('leads')
          .update({
            status: 'warm',
            updated_at: new Date().toISOString(),
          })
          .eq('id', leadId)
        
        console.log('✅ Updated cold lead to warm')
      }
      if (resolvedAgentId && !existingLead.agent_id) {
        await supabase
          .from('leads')
          .update({ agent_id: resolvedAgentId, updated_at: new Date().toISOString() } as never)
          .eq('id', leadId)
      }
    } else {
      // New lead - create
      console.log('📝 Creating new inbound lead')

      const { data: newLead, error: insertError } = await supabase
        .from('leads')
        .insert({
          name: customer?.name || 'Inbound Caller',
          phone: customerPhone,
          email: customer?.email || null,
          source: 'inbound',
          status: 'new',
          ...(resolvedAgentId ? { agent_id: resolvedAgentId } : {}),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (insertError) {
        console.error('❌ Error creating inbound lead:', insertError)
        throw new Error(`Database error: ${insertError.message}`)
      }

      leadId = newLead.id
      console.log('✅ Inbound lead created:', leadId)

      // Sync to GoHighLevel (async)
      syncToGoHighLevel({
        name: newLead.name,
        email: newLead.email,
        phone: newLead.phone,
        source: 'inbound',
      })
        .then(result => {
          if (result.success && result.contactId) {
            supabase
              .from('leads')
              .update({ ghl_contact_id: result.contactId })
              .eq('id', leadId)
              .then(() => console.log('✅ Inbound lead synced to GHL'))
          }
        })
        .catch(err => console.error('⚠️ GHL sync failed:', err))
    }

    const { data: leadForCall } = await supabase
      .from('leads')
      .select('name, email')
      .eq('id', leadId)
      .maybeSingle()
    const leadName = leadForCall?.name || customer?.name || 'Inbound Caller'
    const leadEmail = leadForCall?.email ?? customer?.email ?? null

    // Create call record (agent_id required for dashboard Leads/Calls lists)
    const { data: callRecord, error: callError } = await supabase
      .from('calls')
      .insert({
        agent_id: resolvedAgentId,
        lead_id: leadId,
        vapi_call_id: callId,
        call_type: 'inbound',
        status: 'active',
        lead_name: leadName,
        lead_phone: customerPhone,
        lead_email: leadEmail,
        lead_source: 'inbound',
        started_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (callError) {
      console.error('❌ Error creating call record:', callError)
      throw new Error(`Failed to create call record: ${callError.message}`)
    }

    console.log('✅ Inbound call record created:', callRecord.id)

    return {
      success: true,
      callId: callRecord.id,
    }
  } catch (error: any) {
    console.error('❌ Error handling inbound call:', error.message)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * Update inbound call when it ends
 */
export async function updateInboundCall(payload: any): Promise<void> {
  try {
    const {
      call,
      transcript,
      recordingUrl,
      duration,
      endedReason,
    } = payload

    const vapiCallId = call?.id || payload.id

    if (!vapiCallId) {
      console.warn('⚠️ No call ID in inbound call update')
      return
    }

    // Find the call record
    const { data: callRecord } = await supabase
      .from('calls')
      .select('*')
      .eq('vapi_call_id', vapiCallId)
      .single()

    if (!callRecord) {
      console.warn('⚠️ Call record not found for:', vapiCallId)
      return
    }

    const durationSec = typeof duration === 'number' ? duration : 0
    const hasTranscript = Boolean(transcript && String(transcript).trim())
    const mapInboundOutcome = (reason: string | undefined, dur: number, hasT: boolean): string | null => {
      const r = (reason || '').toLowerCase()
      if (r.includes('voicemail') || r.includes('machine')) return 'voicemail'
      if (
        r.includes('no-answer') ||
        r.includes('no_answer') ||
        r.includes('customer-busy') ||
        r.includes('customer-did-not-answer') ||
        r.includes('busy') ||
        r.includes('timeout')
      ) {
        return 'not_reached'
      }
      if (dur > 0 && dur < 4 && !hasT) return 'not_reached'
      if (hasT && dur >= 4) return 'qualified'
      if (hasT) return 'callback'
      return null
    }

    // Update call record
    await supabase
      .from('calls')
      .update({
        status: 'completed',
        transcript: transcript || null,
        recording_url: recordingUrl || null,
        duration: durationSec,
        outcome: endedReason || null,
        call_outcome: mapVapiToCallOutcome(endedReason, durationSec, hasTranscript),
        ended_at: new Date().toISOString(),
      })
      .eq('id', callRecord.id)

    console.log('✅ Inbound call updated:', callRecord.id)

    // Parse transcript for lead qualification (if available)
    if (transcript && callRecord.lead_id) {
      await extractLeadInfoFromTranscript(callRecord.lead_id, transcript)
    }
  } catch (error: any) {
    console.error('❌ Error updating inbound call:', error.message)
  }
}

/**
 * Extract lead information from call transcript
 * Parse budget, timeline, location, etc. from the conversation
 */
async function extractLeadInfoFromTranscript(leadId: string, transcript: string): Promise<void> {
  try {
    const updates: any = {}

    // Simple keyword-based extraction (can be improved with AI/NLP)
    const lowerTranscript = transcript.toLowerCase()

    // Extract budget
    const budgetMatch = lowerTranscript.match(/(\$?\d{3,}k?|\d+\s*thousand|\d+\s*million)/i)
    if (budgetMatch) {
      updates.budget = budgetMatch[0]
    }

    // Extract timeline
    if (lowerTranscript.includes('immediately') || lowerTranscript.includes('asap') || lowerTranscript.includes('right now')) {
      updates.timeline = 'immediately'
      updates.status = 'hot'
    } else if (lowerTranscript.includes('1-3 months') || lowerTranscript.includes('1 to 3')) {
      updates.timeline = '1-3 months'
      updates.status = 'warm'
    } else if (lowerTranscript.includes('3-6 months') || lowerTranscript.includes('3 to 6')) {
      updates.timeline = '3-6 months'
    } else if (lowerTranscript.includes('6+ months') || lowerTranscript.includes('just looking')) {
      updates.timeline = '6+ months'
      updates.status = 'cold'
    }

    // Extract property type
    if (lowerTranscript.includes('condo')) {
      updates.property_type = 'Condo'
    } else if (lowerTranscript.includes('townhouse')) {
      updates.property_type = 'Townhouse'
    } else if (lowerTranscript.includes('single family') || lowerTranscript.includes('house')) {
      updates.property_type = 'Single Family Home'
    }

    // Update lead if we found any info
    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString()
      
      await supabase
        .from('leads')
        .update(updates)
        .eq('id', leadId)

      console.log('✅ Lead info extracted from transcript:', Object.keys(updates))
    }
  } catch (error: any) {
    console.error('❌ Error extracting lead info:', error.message)
  }
}
