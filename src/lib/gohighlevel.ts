/**
 * GoHighLevel CRM Integration
 * 
 * Syncs leads to GoHighLevel CRM automatically
 */

export interface GoHighLevelContact {
  firstName: string
  lastName: string
  email?: string
  phone: string
  tags?: string[]
  source?: string
  customFields?: Record<string, any>
}

export interface GoHighLevelResponse {
  success: boolean
  contactId?: string
  error?: string
}

/**
 * Sync lead to GoHighLevel CRM
 * @param leadData - Lead information
 * @returns GHL contact ID if successful
 */
export async function syncToGoHighLevel(leadData: {
  name: string
  email?: string
  phone: string
  location?: string
  timeline?: string
  source?: string
  budget?: string
}): Promise<GoHighLevelResponse> {
  const GHL_API_KEY = process.env.GHL_API_KEY || process.env.VITE_GHL_API_KEY
  const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || process.env.VITE_GHL_LOCATION_ID

  // Check if GHL is configured
  if (!GHL_API_KEY) {
    console.warn('⚠️ GoHighLevel API key not configured. Skipping sync.')
    return { success: false, error: 'GHL_API_KEY not configured' }
  }

  try {
    // Split name into first and last name
    const nameParts = leadData.name.trim().split(' ')
    const firstName = nameParts[0] || leadData.name
    const lastName = nameParts.slice(1).join(' ') || ''

    // Prepare contact data
    const contactData: any = {
      firstName,
      lastName,
      phone: leadData.phone,
      tags: ['gnanova-lead', leadData.source || 'website'],
    }

    // Add optional fields
    if (leadData.email) {
      contactData.email = leadData.email
    }

    if (GHL_LOCATION_ID) {
      contactData.locationId = GHL_LOCATION_ID
    }

    // Add custom fields
    contactData.customFields = []
    if (leadData.location) {
      contactData.customFields.push({
        key: 'location',
        value: leadData.location,
      })
    }
    if (leadData.timeline) {
      contactData.customFields.push({
        key: 'timeline',
        value: leadData.timeline,
      })
    }
    if (leadData.budget) {
      contactData.customFields.push({
        key: 'budget',
        value: leadData.budget,
      })
    }
    if (leadData.source) {
      contactData.customFields.push({
        key: 'lead_source',
        value: leadData.source,
      })
    }

    console.log('📤 Syncing lead to GoHighLevel:', leadData.name)

    // Call GoHighLevel API
    const response = await fetch('https://rest.gohighlevel.com/v1/contacts/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(contactData),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `GHL API error: ${response.status}`)
    }

    const result = await response.json()
    
    console.log('✅ Lead synced to GoHighLevel:', result.contact?.id || result.id)

    return {
      success: true,
      contactId: result.contact?.id || result.id,
    }
  } catch (error: any) {
    console.error('❌ Error syncing to GoHighLevel:', error.message)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * Update existing GoHighLevel contact
 * @param contactId - GHL contact ID
 * @param updates - Fields to update
 */
export async function updateGoHighLevelContact(
  contactId: string,
  updates: Partial<GoHighLevelContact>
): Promise<GoHighLevelResponse> {
  const GHL_API_KEY = process.env.GHL_API_KEY || process.env.VITE_GHL_API_KEY

  if (!GHL_API_KEY) {
    return { success: false, error: 'GHL_API_KEY not configured' }
  }

  try {
    const response = await fetch(`https://rest.gohighlevel.com/v1/contacts/${contactId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `GHL API error: ${response.status}`)
    }

    return { success: true, contactId }
  } catch (error: any) {
    console.error('❌ Error updating GHL contact:', error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Check if GoHighLevel integration is enabled
 */
export async function isGoHighLevelEnabled(): Promise<boolean> {
  const GHL_API_KEY = process.env.GHL_API_KEY || process.env.VITE_GHL_API_KEY
  return !!GHL_API_KEY
}
