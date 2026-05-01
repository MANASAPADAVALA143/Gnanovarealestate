import { supabase } from '../lib/supabase'
import { mapVapiToCallOutcome } from '../lib/call-outcome'
import Anthropic from '@anthropic-ai/sdk'

// Support both Vite (import.meta.env) and Node.js (process.env) contexts
const getEnvVar = (key: string): string | undefined => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key]
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key]
  }
  return undefined
}

const anthropicApiKey = getEnvVar('VITE_ANTHROPIC_API_KEY') || getEnvVar('ANTHROPIC_API_KEY')

const anthropic = anthropicApiKey ? new Anthropic({
  apiKey: anthropicApiKey,
}) : null

type VapiWebhookPayload = {
  type: string
  call: {
    id: string
    phoneNumber: string
    transcript?: string
    recordingUrl?: string
    duration?: number
    status: string
    metadata?: {
      agentId?: string
      agentName?: string
      leadId?: string
    }
  }
}

type VapiWebhookMessage = {
  type: string
  message?: {
    type: string
    functionCall?: {
      name: string
      parameters: any
    }
    toolCallId?: string
  }
  call?: any
  transcript?: string
}

export async function handleVapiWebhook(payload: any) {
  try {
    // Handle different webhook types
    if (payload.type === 'function-call' || payload.message?.type === 'function-call') {
      return await handleFunctionCall(payload)
    }

    if (payload.type === 'call-start' || payload.message?.type === 'call-start') {
      console.log('Call started:', payload.call?.id)
      return { success: true }
    }

    if (payload.type === 'transcript' || payload.message?.type === 'transcript') {
      console.log('Transcript update received')
      return { success: true }
    }

    // Only process completed calls
    if (payload.type !== 'call.ended') {
      console.log('Ignoring non-ended call event:', payload.type)
      return { success: true }
    }

    const { call } = payload
    const endedReason = call?.endedReason ?? call?.endReason ?? payload?.endedReason
    const durationSec = typeof call?.duration === 'number' ? call.duration : 0
    const hasTranscript = Boolean(call?.transcript && String(call.transcript).trim())
    console.log('Processing completed call:', call.id)

    // Check if Supabase is configured
    if (!supabase) {
      console.warn('Supabase not configured. Webhook data will not be saved to database.')
      return { success: true, message: 'Webhook received but Supabase not configured' }
    }

    // Parse transcript with Claude
    let leadData: any = {}
    if (call.transcript) {
      leadData = await parseTranscriptWithClaude(call.transcript)
    }

    // Calculate lead score
    const score = calculateLeadScore(leadData)
    const status = getLeadStatus(score)

    // Save to database
    const { data: callRecord, error } = await supabase
      .from('calls')
      .insert({
        agent_id: call.metadata?.agentId,
        vapi_call_id: call.id,
        lead_name: leadData.name || 'Unknown',
        lead_phone: call.phoneNumber,
        lead_email: leadData.email || null,
        lead_source: 'vapi_call',
        transcript: call.transcript || null,
        call_duration: call.duration || 0,
        call_status: 'completed',
        recording_url: call.recordingUrl || null,
        ai_score: score,
        lead_status: status,
        budget_min: leadData.budgetMin || null,
        budget_max: leadData.budgetMax || null,
        property_type: leadData.propertyTypes || [],
        bedrooms_min: leadData.bedroomsMin || null,
        bedrooms_max: leadData.bedroomsMax || null,
        location_preference: leadData.locations || [],
        timeline: leadData.timeline || null,
        pre_approved: leadData.preApproved || null,
        first_time_buyer: leadData.firstTimeBuyer || null,
        working_with_other_agent: leadData.hasOtherAgent || null,
        appointment_booked: leadData.appointmentBooked || false,
        appointment_date: leadData.appointmentDate || null,
        ai_summary: leadData.summary || null,
        call_outcome: mapVapiToCallOutcome(endedReason, durationSec, hasTranscript),
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving call:', error)
      throw error
    }

    console.log('Call saved successfully:', callRecord.id)

    // Log activity
    if (supabase) {
      await supabase.from('activity_log').insert({
      agent_id: call.metadata?.agentId,
      call_id: callRecord.id,
      activity_type: 'call_completed',
        description: `Call completed with ${leadData.name || 'Unknown'}. Score: ${score}`,
        metadata: { score, status },
      })
    }

    return {
      success: true,
      callId: callRecord.id,
      leadStatus: status,
      score,
    }
  } catch (error) {
    console.error('Webhook processing error:', error)
    throw error
  }
}

async function handleFunctionCall(payload: any) {
  try {
    const { checkViewingSlots, bookViewing, updateLeadStatus } = await import('./vapi-functions')
    
    const functionCall = payload.message?.functionCall || payload.functionCall
    const toolCallId = payload.message?.toolCallId || payload.toolCallId

    if (!functionCall) {
      console.warn('No function call found in payload')
      return { success: true }
    }

    console.log('Handling function call:', functionCall.name)

    switch (functionCall.name) {
      case 'check_viewing_slots': {
        const slots = await checkViewingSlots(functionCall.parameters?.propertyId || '')
        return {
          results: [
            {
              toolCallId: toolCallId,
              result: JSON.stringify({
                available_slots: slots,
                message: `We have ${slots.length} slots available this week.`,
              }),
            },
          ],
        }
      }

      case 'book_viewing': {
        const booking = await bookViewing(functionCall.parameters)
        
        // TODO: Send WhatsApp confirmation (implement when WhatsApp API is available)
        // await sendWhatsAppConfirmation(booking)
        
        return {
          results: [
            {
              toolCallId: toolCallId,
              result: JSON.stringify({
                success: true,
                bookingId: booking.id,
                message: `Viewing booked for ${booking.date} at ${booking.time}. Confirmation will be sent shortly.`,
              }),
            },
          ],
        }
      }

      case 'update_lead_status': {
        await updateLeadStatus(functionCall.parameters)
        return {
          results: [
            {
              toolCallId: toolCallId,
              result: JSON.stringify({ success: true }),
            },
          ],
        }
      }

      default:
        console.warn('Unknown function call:', functionCall.name)
        return {
          results: [
            {
              toolCallId: toolCallId,
              result: JSON.stringify({ success: true, message: 'Function not implemented' }),
            },
          ],
        }
    }
  } catch (error) {
    console.error('Error handling function call:', error)
    return {
      results: [
        {
          toolCallId: payload.message?.toolCallId || payload.toolCallId,
          result: JSON.stringify({ 
            success: false, 
            error: error?.message || 'Function call failed' 
          }),
        },
      ],
    }
  }
}

async function parseTranscriptWithClaude(transcript: string) {
  try {
    if (!anthropic) {
      console.warn('Anthropic API key not configured, skipping transcript parsing')
      return {}
    }
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Parse this real estate lead qualification call transcript and extract structured data.

Transcript:
${transcript}

Return ONLY valid JSON with this exact structure (use null for missing data):
{
  "name": "lead's full name or null",
  "email": "email address or null",
  "budgetMin": number or null,
  "budgetMax": number or null,
  "propertyTypes": ["single-family", "condo", etc] or [],
  "bedroomsMin": number or null,
  "bedroomsMax": number or null,
  "locations": ["city/neighborhood names"] or [],
  "timeline": "now" | "1-3-months" | "3-6-months" | "6-12-months" | "exploring" | null,
  "preApproved": true | false | null,
  "firstTimeBuyer": true | false | null,
  "hasOtherAgent": true | false | null,
  "appointmentBooked": true | false,
  "appointmentDate": "ISO date string or null",
  "summary": "2-3 sentence summary of the call"
}`,
        },
      ],
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude')
    }

    // Extract JSON from response (Claude might wrap it in markdown)
    let jsonText = content.text.trim()
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '')
    }

    return JSON.parse(jsonText)
  } catch (error) {
    console.error('Error parsing transcript with Claude:', error)
    return {}
  }
}

function calculateLeadScore(data: any): number {
  let score = 0

  // Budget mentioned: +20
  if (data.budgetMin || data.budgetMax) score += 20

  // Timeline scoring
  switch (data.timeline) {
    case 'now':
      score += 40
      break
    case '1-3-months':
      score += 30
      break
    case '3-6-months':
      score += 20
      break
    case '6-12-months':
      score += 10
      break
  }

  // Pre-approved: +25
  if (data.preApproved === true) score += 25

  // Specific location: +10
  if (data.locations && data.locations.length > 0) score += 10

  // Property type mentioned: +5
  if (data.propertyTypes && data.propertyTypes.length > 0) score += 5

  return Math.min(score, 100)
}

function getLeadStatus(score: number): string {
  if (score >= 80) return 'hot'
  if (score >= 60) return 'warm'
  return 'cold'
}







