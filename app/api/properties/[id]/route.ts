import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Property, PropertySearchResult } from '../../../../types/property'
import { requireAgentOrVapi } from '../../../../lib/require-vapi-secret'

type RouteParams = {
  params: {
    id: string
  }
}

type SearchRow = Property & {
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

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await requireAgentOrVapi(req)
  if (auth instanceof NextResponse) return auth

  const { id } = params

  if (!id || typeof id !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Property ID is required' },
      { status: 400 }
    )
  }

  try {
    const supabase = getSupabaseServerClient()

    // 1. Fetch the main property
    const { data: property, error } = await supabase
      .from('properties')
      .select('*')
      .eq('id', id)
      .single<Property>()

    if (error) {
      console.error('Error fetching property by ID:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch property' },
        { status: 500 }
      )
    }

    if (!property) {
      return NextResponse.json(
        { success: false, error: 'Property not found' },
        { status: 404 }
      )
    }

    // 2. Find similar properties using the existing embedding
    let similar: PropertySearchResult[] = []

    if (property.embedding && Array.isArray(property.embedding)) {
      try {
        const { data: simData, error: simError } = await supabase.rpc('search_properties', {
          query_embedding: property.embedding,
          match_count: 10,
          similarity_threshold: 0,
        })

        if (simError) {
          console.error('Error calling search_properties for similar properties:', simError)
        } else {
          const rows = (simData ?? []) as SearchRow[]

          similar = rows
            .filter((row) => row.id !== property.id)
            .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
            .slice(0, 3)
            .map((row, index) => ({
              ...(row as Property),
              similarity_score: row.similarity ?? 0,
              rank: index + 1,
            }))
        }
      } catch (simError) {
        console.error('Unexpected error while fetching similar properties:', simError)
      }
    } else {
      console.warn(
        `Property ${property.id} does not have an embedding. Similar properties will not be returned.`
      )
    }

    return NextResponse.json(
      {
        success: true,
        property,
        similarProperties: similar,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error in GET /api/properties/[id]:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Unexpected server error' },
      { status: 500 }
    )
  }
}

