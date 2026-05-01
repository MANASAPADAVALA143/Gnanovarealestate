import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Simple in-memory cache with TTL
type CacheEntry<T> = {
  data: T
  expiresAt: number
}

const cache = new Map<string, CacheEntry<any>>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }
  return entry.data as T
}

function setCached<T>(key: string, data: T): void {
  cache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  })
}

function getSupabaseServerClient(): SupabaseClient {
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

async function getTodayStats(supabase: SupabaseClient) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStart = today.toISOString()

  // Calls today
  const { data: callsToday, error: callsError } = await supabase
    .from('calls')
    .select('id, ai_score, lead_status, appointment_booked')
    .gte('created_at', todayStart)

  if (callsError) {
    console.error('Error fetching today calls:', callsError)
  }

  const callsCount = callsToday?.length ?? 0
  const hotLeads = callsToday?.filter((c) => c.lead_status === 'hot').length ?? 0
  const appointmentsBooked = callsToday?.filter((c) => c.appointment_booked).length ?? 0

  const scores = callsToday?.filter((c) => c.ai_score !== null).map((c) => c.ai_score!) ?? []
  const avgLeadScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0

  return {
    calls: callsCount,
    hotLeads,
    appointmentsBooked,
    avgLeadScore,
  }
}

async function getThisWeekStats(supabase: SupabaseClient) {
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  weekAgo.setHours(0, 0, 0, 0)
  const weekStart = weekAgo.toISOString()

  // Calls this week
  const { data: callsWeek, error: callsError } = await supabase
    .from('calls')
    .select('id, lead_status, appointment_booked')
    .gte('created_at', weekStart)

  if (callsError) {
    console.error('Error fetching week calls:', callsError)
  }

  const callsCount = callsWeek?.length ?? 0
  const hotLeads = callsWeek?.filter((c) => c.lead_status === 'hot').length ?? 0
  const appointmentsBooked = callsWeek?.filter((c) => c.appointment_booked).length ?? 0

  // Conversion rate: appointments / calls
  const conversionRate = callsCount > 0 ? Number((appointmentsBooked / callsCount).toFixed(2)) : 0

  return {
    calls: callsCount,
    hotLeads,
    appointmentsBooked,
    conversionRate,
  }
}

async function getTopProperties(supabase: SupabaseClient) {
  // Get properties with most recommendations/bookings
  // This is a simplified version - you might want to track property views separately

  // Get property recommendations count
  const { data: recommendations, error: recError } = await supabase
    .from('property_recommendations')
    .select('property_id')
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // last 30 days

  if (recError) {
    console.error('Error fetching property recommendations:', recError)
  }

  // Count recommendations per property
  const propertyCounts = new Map<string, number>()
  recommendations?.forEach((rec) => {
    const count = propertyCounts.get(rec.property_id) ?? 0
    propertyCounts.set(rec.property_id, count + 1)
  })

  // Get bookings per property
  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('property_id')
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

  if (bookingsError) {
    console.error('Error fetching bookings:', bookingsError)
  }

  bookings?.forEach((booking) => {
    const count = propertyCounts.get(booking.property_id) ?? 0
    propertyCounts.set(booking.property_id, count + 1)
  })

  // Get top 5 property IDs
  const topPropertyIds = Array.from(propertyCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id)

  if (topPropertyIds.length === 0) {
    return []
  }

  // Fetch property details
  const { data: properties, error: propsError } = await supabase
    .from('properties')
    .select('id, address, city, state, price, bedrooms, bathrooms, photos')
    .in('id', topPropertyIds)

  if (propsError) {
    console.error('Error fetching top properties:', propsError)
    return []
  }

  // Sort by inquiry count
  return properties
    ?.map((prop) => ({
      ...prop,
      inquiryCount: propertyCounts.get(prop.id) ?? 0,
    }))
    .sort((a, b) => b.inquiryCount - a.inquiryCount) ?? []
}

async function getRecentActivity(supabase: SupabaseClient) {
  const activities: Array<{
    type: 'call' | 'booking' | 'search'
    timestamp: string
    description: string
    metadata?: any
  }> = []

  // Recent calls (last 10)
  const { data: recentCalls, error: callsError } = await supabase
    .from('calls')
    .select('id, created_at, lead_name, lead_phone, lead_status')
    .order('created_at', { ascending: false })
    .limit(10)

  if (!callsError && recentCalls) {
    recentCalls.forEach((call) => {
      activities.push({
        type: 'call',
        timestamp: call.created_at,
        description: `Call with ${call.lead_name || 'Unknown'} (${call.lead_phone})`,
        metadata: {
          leadStatus: call.lead_status,
          callId: call.id,
        },
      })
    })
  }

  // Recent bookings (last 10)
  const { data: recentBookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('id, created_at, scheduled_date, scheduled_time, property_id')
    .order('created_at', { ascending: false })
    .limit(10)

  if (!bookingsError && recentBookings) {
    // Fetch property details for bookings
    const propertyIds = recentBookings.map((b) => b.property_id)
    const { data: properties } = await supabase
      .from('properties')
      .select('id, address, city')
      .in('id', propertyIds)

    const propertyMap = new Map(properties?.map((p) => [p.id, p]) ?? [])

    recentBookings.forEach((booking) => {
      const prop = propertyMap.get(booking.property_id)
      const address = prop ? `${prop.address}, ${prop.city}` : 'Unknown property'
      activities.push({
        type: 'booking',
        timestamp: booking.created_at,
        description: `Viewing scheduled: ${address} on ${booking.scheduled_date} at ${booking.scheduled_time}`,
        metadata: {
          bookingId: booking.id,
          propertyId: booking.property_id,
        },
      })
    })
  }

  // Sort all activities by timestamp (most recent first) and take top 10
  return activities
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10)
}

export async function GET(req: NextRequest) {
  try {
    // Check cache
    const cacheKey = 'analytics:stats'
    const cached = getCached<any>(cacheKey)
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          'X-Cache': 'HIT',
        },
      })
    }

    const supabase = getSupabaseServerClient()

    // Fetch all stats in parallel
    const [today, thisWeek, topProperties, recentActivity] = await Promise.all([
      getTodayStats(supabase),
      getThisWeekStats(supabase),
      getTopProperties(supabase),
      getRecentActivity(supabase),
    ])

    const response = {
      today,
      thisWeek,
      topProperties,
      recentActivity,
    }

    // Cache the response
    setCached(cacheKey, response)

    return NextResponse.json(response, {
      headers: {
        'X-Cache': 'MISS',
      },
    })
  } catch (error: any) {
    console.error('Error fetching analytics stats:', error)
    return NextResponse.json(
      {
        error: error?.message || 'Failed to fetch analytics stats',
        today: { calls: 0, hotLeads: 0, appointmentsBooked: 0, avgLeadScore: 0 },
        thisWeek: { calls: 0, hotLeads: 0, appointmentsBooked: 0, conversionRate: 0 },
        topProperties: [],
        recentActivity: [],
      },
      { status: 500 }
    )
  }
}
