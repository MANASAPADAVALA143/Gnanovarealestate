import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Property } from '../../../../types/property'
import { requireAgentOrVapi } from '../../../../lib/require-vapi-secret'

type SendPropertyWhatsAppBody = {
  phone: string
  propertyIds: string[]
  leadName: string
}

function getSupabaseClient(): SupabaseClient {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL

  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY

  if (!url) {
    throw new Error(
      'Supabase URL is not configured. Please set SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL in your environment.'
    )
  }

  if (!serviceKey) {
    throw new Error(
      'Supabase service role key is not configured. Please set SUPABASE_SERVICE_ROLE_KEY in your environment.'
    )
  }

  return createClient(url, serviceKey)
}

function validateRequest(body: any): SendPropertyWhatsAppBody {
  if (!body || typeof body !== 'object') {
    throw new Error('Request body must be a JSON object')
  }

  const { phone, propertyIds, leadName } = body

  if (!phone || typeof phone !== 'string') {
    throw new Error('phone is required and must be a string')
  }

  if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
    throw new Error('propertyIds is required and must be a non-empty array of IDs')
  }

  if (!leadName || typeof leadName !== 'string') {
    throw new Error('leadName is required and must be a string')
  }

  return { phone, propertyIds, leadName }
}

function formatWhatsAppMessage(leadName: string, properties: Property[]): string {
  let message = `Hi ${leadName}! Here are the properties you asked about:\n\n`

  properties.forEach((p, index) => {
    const num = index + 1
    const address = [p.address, p.city, p.state, p.zip_code].filter(Boolean).join(', ')
    const price = p.price ? `$${p.price.toLocaleString()}` : 'Price not specified'
    const beds = p.bedrooms ?? 'N/A'
    const baths = p.bathrooms ?? 'N/A'

    const amenities = p.amenities ?? []
    const keyFeatures =
      amenities.length > 0
        ? amenities.slice(0, 3).join(', ')
        : (p.description ?? '').split('.').slice(0, 1).join('.')

    const tourLine = p.virtual_tour_url
      ? `Virtual tour: ${p.virtual_tour_url}\n`
      : ''

    message += `${num}) ${address}\n`
    message += `   • Price: ${price}\n`
    message += `   • Beds/Baths: ${beds} bed / ${baths} bath\n`
    if (keyFeatures) {
      message += `   • Features: ${keyFeatures}\n`
    }
    if (tourLine) {
      message += `   • ${tourLine}`
    }
    message += '\n'
  })

  message +=
    'Reply with the number of the property you like best, and your agent will follow up to schedule a viewing or share more details.'

  return message
}

async function sendWhatsAppMessage(
  toPhone: string,
  body: string,
  mediaUrl?: string
) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromWhatsApp = process.env.TWILIO_WHATSAPP_FROM

  if (!accountSid || !authToken || !fromWhatsApp) {
    throw new Error(
      'Twilio configuration missing. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_FROM.'
    )
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`

  const params = new URLSearchParams()
  params.append('To', `whatsapp:${toPhone}`)
  params.append('From', `whatsapp:${fromWhatsApp}`)
  params.append('Body', body)

  if (mediaUrl) {
    params.append('MediaUrl', mediaUrl)
  }

  const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authHeader}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    console.error('Twilio WhatsApp API error:', response.status, response.statusText, data)
    throw new Error('Failed to send WhatsApp message via Twilio')
  }

  return data
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAgentOrVapi(req)
    if (auth instanceof NextResponse) return auth

    const rawBody = await req.json().catch(() => null)
    const { phone, propertyIds, leadName } = validateRequest(rawBody)

    const supabase = getSupabaseClient()

    // 1. Fetch property details
    const { data: properties, error } = await supabase
      .from('properties')
      .select('*')
      .in('id', propertyIds)

    if (error) {
      console.error('Error fetching properties for WhatsApp send:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch properties' },
        { status: 500 }
      )
    }

    if (!properties || properties.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No properties found for the given IDs' },
        { status: 404 }
      )
    }

    const messageBody = formatWhatsAppMessage(leadName, properties as Property[])

    // Use first property's first photo as thumbnail if available
    const firstProperty = properties[0] as Property
    const firstPhoto =
      firstProperty.photos && firstProperty.photos.length > 0
        ? firstProperty.photos[0]
        : undefined

    // 3. Send via Twilio WhatsApp API
    const twilioResponse = await sendWhatsAppMessage(phone, messageBody, firstPhoto)

    // 4. Log message to database (best-effort)
    try {
      const { error: logError } = await supabase.from('whatsapp_messages').insert({
        phone,
        lead_name: leadName,
        property_ids: propertyIds,
        twilio_sid: twilioResponse.sid,
        status: twilioResponse.status,
        provider: 'twilio',
        raw_payload: twilioResponse,
        created_at: new Date().toISOString(),
      })

      if (logError) {
        console.error('Error logging WhatsApp message:', logError)
      }
    } catch (logError) {
      console.error('Unexpected error logging WhatsApp message:', logError)
    }

    return NextResponse.json(
      {
        success: true,
        properties,
        twilioSid: twilioResponse.sid,
        twilioStatus: twilioResponse.status,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error in /api/whatsapp/send-property:', error)
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Unexpected server error',
      },
      { status: 500 }
    )
  }
}

