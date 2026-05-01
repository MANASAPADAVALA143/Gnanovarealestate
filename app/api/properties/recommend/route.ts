import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Property, PropertySearchResult } from '../../../../types/property'
import { generateQueryEmbedding } from '../../../../lib/embeddings'

type RecommendRequestBody = {
  leadId: string
  preferences: {
    budget_max?: number
    bedrooms?: number
    location?: string
    must_have?: string[]
  }
}

type SearchRow = Property & { similarity: number }

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

function buildQueryFromPreferences(prefs: RecommendRequestBody['preferences']): string {
  const parts: string[] = []

  if (prefs.bedrooms) {
    parts.push(`${prefs.bedrooms} bedroom`)
  }

  if (prefs.budget_max) {
    parts.push(`under $${prefs.budget_max.toLocaleString()}`)
  }

  if (prefs.location) {
    parts.push(`in ${prefs.location}`)
  }

  if (prefs.must_have && prefs.must_have.length > 0) {
    parts.push(`with ${prefs.must_have.join(', ')}`)
  }

  return parts.length > 0 ? parts.join(' ') : 'best matching properties for this lead'
}

function filterAndRankResults(
  rows: SearchRow[],
  prefs: RecommendRequestBody['preferences']
): PropertySearchResult[] {
  let results = [...rows]

  if (typeof prefs.budget_max === 'number') {
    results = results.filter((p) => (p.price ?? Number.MAX_SAFE_INTEGER) <= prefs.budget_max!)
  }

  if (typeof prefs.bedrooms === 'number') {
    results = results.filter((p) => (p.bedrooms ?? 0) >= prefs.bedrooms!)
  }

  if (prefs.location) {
    const loc = prefs.location.toLowerCase()
    results = results.filter((p) => {
      const city = p.city?.toLowerCase() ?? ''
      const state = p.state?.toLowerCase() ?? ''
      return city.includes(loc) || state.includes(loc)
    })
  }

  if (prefs.must_have && prefs.must_have.length > 0) {
    const must = prefs.must_have.map((m) => m.toLowerCase())
    results = results.filter((p) => {
      const amenities = (p.amenities ?? []).map((a) => a.toLowerCase())
      const desc = (p.description ?? '').toLowerCase()
      return must.every(
        (m) =>
          amenities.some((a) => a.includes(m)) ||
          desc.includes(m)
      )
    })
  }

  return results
    .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
    .slice(0, 5)
    .map((p, index) => ({
      ...(p as Property),
      similarity_score: p.similarity ?? 0,
      rank: index + 1,
    }))
}

function buildSummary(
  properties: PropertySearchResult[],
  prefs: RecommendRequestBody['preferences']
): string {
  if (properties.length === 0) {
    return 'I was not able to find any properties that match this lead’s preferences closely. You may want to widen the budget, bedroom count, or locations.'
  }

  const count = properties.length
  const best = properties[0]

  const address = [best.address, best.city, best.state].filter(Boolean).join(', ')
  const price = best.price ? `$${best.price.toLocaleString()}` : 'price not specified'
  const beds = best.bedrooms ?? 'N/A'
  const baths = best.bathrooms ?? 'N/A'

  const pieces: string[] = []

  pieces.push(
    `Based on the lead's preferences, I found ${count} strong matching propert${count === 1 ? 'y' : 'ies'}.`
  )
  pieces.push(
    `The best match is a ${beds}-bedroom, ${baths}-bath home at ${address} listed for ${price}.`
  )

  if (prefs.location) {
    pieces.push(`All recommendations are in or near ${prefs.location}.`)
  }

  if (prefs.must_have && prefs.must_have.length > 0) {
    pieces.push(
      `These homes emphasize: ${prefs.must_have.join(', ')} and similar lifestyle features.`
    )
  }

  if (count > 1) {
    pieces.push('You can review the top 3 first, then follow up with the remaining options.')
  }

  return pieces.join(' ')
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as RecommendRequestBody | null

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Request body must be a JSON object' },
        { status: 400 }
      )
    }

    const { leadId, preferences } = body

    if (!leadId || typeof leadId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'leadId is required and must be a string' },
        { status: 400 }
      )
    }

    if (!preferences || typeof preferences !== 'object') {
      return NextResponse.json(
        { success: false, error: 'preferences object is required' },
        { status: 400 }
      )
    }

    const query = buildQueryFromPreferences(preferences)
    const embedding = await generateQueryEmbedding(query)

    const supabase = getSupabaseClient()

    // Use the same search_properties RPC used elsewhere
    const { data, error } = await supabase.rpc('search_properties', {
      query_embedding: embedding,
      match_count: 40,
      similarity_threshold: 0,
    })

    if (error) {
      console.error('Supabase search_properties RPC error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to search properties' },
        { status: 500 }
      )
    }

    const rows = (data ?? []) as SearchRow[]

    const ranked = filterAndRankResults(rows, preferences)

    // Save recommendations to database (best-effort)
    // Expecting a table like:
    // property_recommendations(lead_id uuid, property_id uuid, score numeric, created_at timestamptz)
    if (ranked.length > 0) {
      try {
        const payload = ranked.map((p) => ({
          lead_id: leadId,
          property_id: p.id,
          score: p.similarity_score,
        }))

        const { error: insertError } = await supabase
          .from('property_recommendations')
          .insert(payload)

        if (insertError) {
          console.error('Error saving property recommendations:', insertError)
        }
      } catch (saveError) {
        console.error('Unexpected error saving property recommendations:', saveError)
      }
    }

    const summary = buildSummary(ranked, preferences)

    // Strip similarity_score and rank before returning as plain Property[]
    const properties: Property[] = ranked.map((p) => {
      const { similarity_score, rank, ...rest } = p
      return rest as Property
    })

    return NextResponse.json(
      {
        success: true,
        properties,
        summary,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error in /api/properties/recommend:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Unexpected server error' },
      { status: 500 }
    )
  }
}

