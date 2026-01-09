import { supabase } from '../lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
})

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

export async function handleVapiWebhook(payload: VapiWebhookPayload) {
  try {
    // Only process completed calls
    if (payload.type !== 'call.ended') {
      console.log('Ignoring non-ended call event:', payload.type)
      return { success: true }
    }

    const { call } = payload
    console.log('Processing completed call:', call.id)

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
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving call:', error)
      throw error
    }

    console.log('Call saved successfully:', callRecord.id)

    // Log activity
    await supabase.from('activity_log').insert({
      agent_id: call.metadata?.agentId,
      call_id: callRecord.id,
      activity_type: 'call_completed',
      description: `Call completed with ${leadData.name || 'Unknown'}. Score: ${score}`,
      metadata: { score, status },
    })

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

async function parseTranscriptWithClaude(transcript: string) {
  try {
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







