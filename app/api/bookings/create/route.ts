import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { requireAgentOrVapi } from '../../../../lib/require-vapi-secret'

type CreateBookingBody = {
  propertyId: string
  leadId: string
  preferredDate: string
  preferredTime: string
  notes?: string
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

function validateBody(body: any): CreateBookingBody {
  if (!body || typeof body !== 'object') {
    throw new Error('Request body must be a JSON object')
  }

  const { propertyId, leadId, preferredDate, preferredTime, notes } = body

  if (!propertyId || typeof propertyId !== 'string') {
    throw new Error('propertyId is required and must be a string')
  }
  if (!leadId || typeof leadId !== 'string') {
    throw new Error('leadId is required and must be a string')
  }
  if (!preferredDate || typeof preferredDate !== 'string') {
    throw new Error('preferredDate is required and must be a string (YYYY-MM-DD)')
  }
  if (!preferredTime || typeof preferredTime !== 'string') {
    throw new Error('preferredTime is required and must be a string (e.g. "2:00 PM")')
  }

  return { propertyId, leadId, preferredDate, preferredTime, notes }
}

// Placeholder for future calendar integration
async function checkAgentAvailability(
  _propertyId: string,
  _preferredDate: string,
  _preferredTime: string
): Promise<'available' | 'busy' | 'unknown'> {
  // In a real implementation, query the agent's calendar or scheduling system.
  return 'unknown'
}

// Placeholder: send confirmation email to the lead
async function sendLeadConfirmationEmail(params: {
  leadId: string
  propertyId: string
  scheduledDate: string
  scheduledTime: string
}) {
  // Integrate with your email provider (SendGrid, Postmark, etc.) here.
  console.log('Sending confirmation email to lead:', params)
}

// Placeholder: send notification to the agent
async function sendAgentNotification(params: {
  leadId: string
  propertyId: string
  scheduledDate: string
  scheduledTime: string
}) {
  // Integrate with internal notification system, email, or Slack here.
  console.log('Sending notification to agent about new booking:', params)
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAgentOrVapi(req)
    if (auth instanceof NextResponse) return auth

    const rawBody = await req.json().catch(() => null)
    const { propertyId, leadId, preferredDate, preferredTime, notes } = validateBody(rawBody)

    const supabase = getSupabaseClient()

    // 1. Create booking record in Supabase
    const availability = await checkAgentAvailability(propertyId, preferredDate, preferredTime)

    const status = availability === 'busy' ? 'pending' : 'pending'

    const { data: booking, error } = await supabase
      .from('bookings')
      .insert({
        property_id: propertyId,
        lead_id: leadId,
        scheduled_date: preferredDate,
        scheduled_time: preferredTime,
        status,
        notes: notes ?? null,
        ...(auth.agentId ? { agent_id: auth.agentId } : {}),
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating booking:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to create booking' },
        { status: 500 }
      )
    }

    // 3. Send confirmation email to lead (placeholder)
    try {
      await sendLeadConfirmationEmail({
        leadId,
        propertyId,
        scheduledDate: preferredDate,
        scheduledTime: preferredTime,
      })
    } catch (emailError) {
      console.error('Error sending lead confirmation email:', emailError)
    }

    // 4. Send notification to agent (placeholder)
    try {
      await sendAgentNotification({
        leadId,
        propertyId,
        scheduledDate: preferredDate,
        scheduledTime: preferredTime,
      })
    } catch (notifyError) {
      console.error('Error sending agent notification:', notifyError)
    }

    // 5. Return booking details
    return NextResponse.json(
      {
        success: true,
        booking,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error in /api/bookings/create:', error)
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Unexpected server error',
      },
      { status: 500 }
    )
  }
}

