import { NextRequest, NextResponse } from 'next/server'

import { requireVapiSecret } from '../../../../lib/require-vapi-secret'
import type { PropertySearchFilters, PropertySearchResult } from '../../../../types/property'

type VapiFunctionCall = {
  name: string
  parameters?: any
}

type VapiMessageBody = {
  message?: {
    type: string
    functionCall?: VapiFunctionCall
  }
}

function vapiSecretHeaderValue(): string | undefined {
  return (
    process.env.VAPI_WEBHOOK_SECRET ||
    process.env.VAPI_SERVER_SECRET ||
    process.env.VITE_VAPI_SERVER_SECRET
  )?.trim()
}

function getAppBaseUrl(): string {
  // Prefer explicit APP_URL, then Vercel URL, then localhost as fallback
  if (process.env.APP_URL) return process.env.APP_URL
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

function normalizeParameters(params: any): PropertySearchFilters {
  // Parameters may come as JSON string or object
  let obj: any = params
  if (typeof params === 'string') {
    try {
      obj = JSON.parse(params)
    } catch {
      obj = {}
    }
  }

  const query: string =
    typeof obj.query === 'string' && obj.query.trim()
      ? obj.query.trim()
      : 'property search'

  const filters: PropertySearchFilters = { query }

  if (typeof obj.max_price === 'number') filters.maxPrice = obj.max_price
  if (typeof obj.min_price === 'number') filters.minPrice = obj.min_price
  if (typeof obj.min_beds === 'number') filters.minBeds = obj.min_beds
  if (typeof obj.max_beds === 'number') filters.maxBeds = obj.max_beds

  if (typeof obj.location === 'string' && obj.location.trim()) {
    filters.location = obj.location.trim()
  }

  if (typeof obj.property_type === 'string') {
    filters.propertyType = obj.property_type as any
  }

  return filters
}

function formatResultsForSpeech(
  query: string,
  properties: PropertySearchResult[]
): string {
  if (!properties || properties.length === 0) {
    return `I couldn't find any properties that match "${query}" right now. Would you like me to widen the search or adjust your budget or bedroom count?`
  }

  const count = properties.length
  const best = properties[0]

  const address = [best.address, best.city, best.state].filter(Boolean).join(', ')
  const price = best.price ? `$${best.price.toLocaleString()}` : 'price not specified'
  const beds = best.bedrooms ?? 'N/A'
  const baths = best.bathrooms ?? 'N/A'

  const hasGarage =
    (best.parking || '').toLowerCase().includes('garage') ||
    (best.amenities || []).some((a) => a.toLowerCase().includes('garage'))

  const highlights: string[] = []
  if (best.property_type) {
    highlights.push(best.property_type.replace('_', ' '))
  }
  if (hasGarage) {
    highlights.push('garage')
  }
  if (best.school_district) {
    highlights.push('good school district')
  }

  const highlightText =
    highlights.length > 0 ? ` It is a ${highlights.join(', ')} home.` : ''

  const othersCount = count - 1
  const othersText =
    othersCount > 0
      ? ` I also found ${othersCount} other option${othersCount > 1 ? 's' : ''} that match your criteria.`
      : ''

  return `I found ${count} propert${count === 1 ? 'y' : 'ies'} that match your search. The best match is a ${beds}-bedroom, ${baths}-bath home at ${address} listed for ${price}.${highlightText}${othersText} Would you like me to share more details or hear about the other properties?`
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireVapiSecret(req)
    if (auth !== true) return auth

    const body = (await req.json().catch(() => null)) as VapiMessageBody | null

    if (!body || !body.message || body.message.type !== 'function-call') {
      return NextResponse.json(
        { error: 'Invalid VAPI payload: expected function-call message' },
        { status: 400 }
      )
    }

    const fn = body.message.functionCall
    if (!fn || fn.name !== 'search_properties') {
      return NextResponse.json(
        { error: 'Unsupported function call' },
        { status: 400 }
      )
    }

    const filters = normalizeParameters(fn.parameters ?? {})

    const baseUrl = getAppBaseUrl()

    const secret = vapiSecretHeaderValue()
    const response = await fetch(`${baseUrl}/api/properties/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret ? { 'x-vapi-secret': secret } : {}),
      },
      body: JSON.stringify(filters),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      console.error(
        'Property search API call failed:',
        response.status,
        response.statusText,
        text
      )
      return NextResponse.json(
        { error: 'Failed to search properties' },
        { status: 500 }
      )
    }

    const data = (await response.json()) as {
      success: boolean
      properties?: PropertySearchResult[]
      query?: string
    }

    if (!data.success || !data.properties) {
      return NextResponse.json(
        { error: 'Property search API returned no results' },
        { status: 500 }
      )
    }

    const resultText = formatResultsForSpeech(
      data.query ?? filters.query,
      data.properties
    )

    // Response format expected by VAPI function result
    return NextResponse.json(
      {
        result: resultText,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error in /api/vapi/functions:', error)
    return NextResponse.json(
      {
        error: error?.message || 'Unexpected server error',
      },
      { status: 500 }
    )
  }
}

