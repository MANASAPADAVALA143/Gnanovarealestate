/**
 * Facebook Lead Ads Webhook Handler
 * 
 * Handles incoming leads from Facebook Lead Ads
 * - Verifies webhook
 * - Saves lead to database
 * - Triggers VAPI call
 * - Syncs to GoHighLevel
 */

import { supabase } from '../lib/supabase'
import { syncToGoHighLevel } from '../lib/gohighlevel'
import { initiatePublicCall } from './initiate-public-call'
import { onLeadCreated } from '../../lib/crm-hooks'

export interface FacebookLeadData {
  id: string
  created_time: string
  field_data: Array<{
    name: string
    values: string[]
  }>
}

/**
 * Verify Facebook webhook (GET request)
 * Required for initial webhook setup
 */
export function verifyFacebookWebhook(params: {
  'hub.mode'?: string
  'hub.verify_token'?: string
  'hub.challenge'?: string
}): { success: boolean; challenge?: string; error?: string } {
  const mode = params['hub.mode']
  const token = params['hub.verify_token']
  const challenge = params['hub.challenge']

  const VERIFY_TOKEN = process.env.FACEBOOK_VERIFY_TOKEN || process.env.VITE_FACEBOOK_VERIFY_TOKEN || 'gnanova_verify_token_2025'

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Facebook webhook verified')
    return { success: true, challenge }
  }

  console.error('❌ Facebook webhook verification failed')
  return { success: false, error: 'Verification failed' }
}

/**
 * Parse Facebook lead data from field_data array
 */
function parseLeadData(fieldData: Array<{ name: string; values: string[] }>) {
  const data: Record<string, string> = {}
  
  fieldData.forEach(field => {
    const value = field.values[0] || ''
    
    // Map Facebook field names to our field names
    switch (field.name.toLowerCase()) {
      case 'full_name':
      case 'name':
        data.name = value
        break
      case 'email':
        data.email = value
        break
      case 'phone_number':
      case 'phone':
        data.phone = value
        break
      case 'city':
      case 'location':
        data.location = value
        break
      case 'timeline':
      case 'when_are_you_looking_to_buy':
        data.timeline = value
        break
      default:
        // Store any other fields in metadata
        data[field.name] = value
    }
  })

  return data
}

/**
 * Handle Facebook Lead Ads webhook (POST request)
 */
export async function handleFacebookLeadWebhook(payload: any): Promise<{
  success: boolean
  leadId?: string
  error?: string
}> {
  try {
    console.log('📱 Received Facebook Lead Ads webhook')

    // Facebook sends data in this structure
    const entry = payload.entry?.[0]
    const changes = entry?.changes?.[0]
    const leadData: FacebookLeadData = changes?.value

    if (!leadData || !leadData.field_data) {
      throw new Error('Invalid Facebook lead data structure')
    }

    // Parse the lead data
    const parsedData = parseLeadData(leadData.field_data)

    // Validate required fields
    if (!parsedData.name || !parsedData.phone) {
      throw new Error('Missing required fields: name and phone')
    }

    console.log('📝 Parsed Facebook lead:', {
      name: parsedData.name,
      phone: parsedData.phone,
      email: parsedData.email || 'N/A',
    })

    // 1. Save lead to Supabase
    const { data: lead, error: dbError } = await supabase
      .from('leads')
      .insert({
        name: parsedData.name,
        email: parsedData.email || null,
        phone: parsedData.phone,
        location: parsedData.location || null,
        timeline: parsedData.timeline || null,
        source: 'facebook',
        status: 'new',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (dbError) {
      console.error('❌ Error saving Facebook lead:', dbError)
      throw new Error(`Database error: ${dbError.message}`)
    }

    console.log('✅ Facebook lead saved to database:', lead.id)

    void onLeadCreated({
      leadId: lead.id,
      source: 'facebook',
      channel: 'facebook_lead_ads',
      status: 'new',
    })

    // 2. Sync to GoHighLevel (async, don't wait)
    syncToGoHighLevel({
      name: parsedData.name,
      email: parsedData.email,
      phone: parsedData.phone,
      location: parsedData.location,
      timeline: parsedData.timeline,
      source: 'facebook',
    })
      .then(result => {
        if (result.success && result.contactId) {
          // Update lead with GHL contact ID
          supabase
            .from('leads')
            .update({ ghl_contact_id: result.contactId })
            .eq('id', lead.id)
            .then(() => console.log('✅ Lead updated with GHL contact ID'))
        }
      })
      .catch(err => console.error('⚠️ GHL sync failed:', err))

    // 3. Trigger VAPI call immediately
    try {
      console.log('📞 Initiating VAPI call to Facebook lead...')
      
      await initiatePublicCall({
        name: parsedData.name,
        email: parsedData.email || '',
        phone: parsedData.phone,
        location: parsedData.location || '',
        timeline: parsedData.timeline || '1-3 months',
      })

      console.log('✅ VAPI call initiated for Facebook lead')
    } catch (callError: any) {
      console.error('❌ Error initiating VAPI call:', callError.message)
      // Don't throw - we still want to return success since lead was saved
    }

    return {
      success: true,
      leadId: lead.id,
    }
  } catch (error: any) {
    console.error('❌ Error handling Facebook webhook:', error.message)
    return {
      success: false,
      error: error.message,
    }
  }
}
