import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Property, PropertySearchFilters, PropertySearchResult } from '../../../../types/property'
import { generateQueryEmbedding } from '../../../../lib/embeddings'

type SearchPropertiesRow = Property & {
  similarity: number
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

function validateFilters(body: any): PropertySearchFilters {
  if (!body || typeof body !== 'object') {
    throw new Error('Request body must be a JSON object')
  }

  const { query, maxPrice, minPrice, minBeds, maxBeds, location, propertyType } = body

  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new Error('query is required and must be a non-empty string')
  }

  const filters: PropertySearchFilters = {
    query: query.trim(),
  }

  if (typeof maxPrice === 'number') filters.maxPrice = maxPrice
  if (typeof minPrice === 'number') filters.minPrice = minPrice
  if (typeof minBeds === 'number') filters.minBeds = minBeds
  if (typeof maxBeds === 'number') filters.maxBeds = maxBeds
  if (typeof location === 'string' && location.trim()) filters.location = location.trim()
  if (typeof propertyType === 'string') filters.propertyType = propertyType as any

  return filters
}

function applyFilters(
  rows: SearchPropertiesRow[],
  filters: PropertySearchFilters
): PropertySearchResult[] {
  let results = [...rows]

  if (typeof filters.minPrice === 'number') {
    results = results.filter((p) => (p.price ?? 0) >= filters.minPrice!)
  }

  if (typeof filters.maxPrice === 'number') {
    results = results.filter((p) => (p.price ?? Number.MAX_SAFE_INTEGER) <= filters.maxPrice!)
  }

  if (typeof filters.minBeds === 'number') {
    results = results.filter((p) => (p.bedrooms ?? 0) >= filters.minBeds!)
  }

  if (typeof filters.maxBeds === 'number') {
    results = results.filter((p) => (p.bedrooms ?? 0) <= filters.maxBeds!)
  }

  if (filters.location) {
    const loc = filters.location.toLowerCase()
    results = results.filter((p) => {
      const city = p.city?.toLowerCase() ?? ''
      const state = p.state?.toLowerCase() ?? ''
      return city.includes(loc) || state.includes(loc)
    })
  }

  if (filters.propertyType) {
    results = results.filter((p) => p.property_type === filters.propertyType)
  }

  // Map to PropertySearchResult and sort by similarity descending
  const mapped: PropertySearchResult[] = results
    .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
    .slice(0, 5)
    .map((p, index) => ({
      ...(p as Property),
      similarity_score: p.similarity ?? 0,
      rank: index + 1,
    }))

  return mapped
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const filters = validateFilters(body)

    const embedding = await generateQueryEmbedding(filters.query)

    const supabase = getSupabaseServerClient()

    // Call the search_properties SQL function which already uses <=> for similarity
    // and orders by distance. We request more than 5 to allow room for filters,
    // then trim to top 5 in application code.
    const { data, error } = await supabase.rpc('search_properties', {
      query_embedding: embedding,
      match_count: 30,
      similarity_threshold: 0,
    })

    if (error) {
      console.error('Supabase search_properties RPC error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to search properties' },
        { status: 500 }
      )
    }

    const rows = (data ?? []) as SearchPropertiesRow[]

    const properties = applyFilters(rows, filters)

    return NextResponse.json(
      {
        success: true,
        properties,
        query: filters.query,
        resultsCount: properties.length,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error in /api/properties/search:', error)
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Unexpected server error',
      },
      { status: 400 }
    )
  }
}

