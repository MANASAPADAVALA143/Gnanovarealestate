// Load environment variables from .env.local
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

try {
  const envPath = resolve('.env.local')
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf-8')
    envContent.split('\n').forEach((line) => {
      const match = line.match(/^([^#=]+)=(.*)$/)
      if (match) {
        const key = match[1].trim()
        const value = match[2].trim().replace(/^["']|["']$/g, '')
        if (!process.env[key]) {
          process.env[key] = value
        }
      }
    })
  }
} catch {}

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Property, PropertySearchFilters, PropertySearchResult } from '../types/property'
import { generateQueryEmbedding } from '../lib/embeddings'

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

function applyFilters(
  rows: SearchRow[],
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

  const mapped: PropertySearchResult[] = results
    .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
    .slice(0, 3)
    .map((p, index) => ({
      ...(p as Property),
      similarity_score: p.similarity ?? 0,
      rank: index + 1,
    }))

  return mapped
}

async function runSearchTest(
  supabase: SupabaseClient,
  name: string,
  filters: PropertySearchFilters
) {
  console.log('\n========================================')
  console.log(`🧪 Test: ${name}`)
  console.log(`Query: "${filters.query}"`)
  console.log('----------------------------------------')

  try {
    const embedding = await generateQueryEmbedding(filters.query)

    const { data, error } = await supabase.rpc('search_properties', {
      query_embedding: embedding,
      match_count: 25,
      similarity_threshold: 0,
    })

    if (error) {
      console.error('❌ Supabase RPC error:', error)
      return
    }

    const rows = (data ?? []) as SearchRow[]
    const results = applyFilters(rows, filters)

    if (results.length === 0) {
      console.log('No results returned for this query.')
      return
    }

    results.forEach((prop, idx) => {
      const address = [prop.address, prop.city, prop.state].filter(Boolean).join(', ')
      console.log(
        `${idx + 1}. ${address} | $${(prop.price ?? 0).toLocaleString()} | beds: ${
          prop.bedrooms ?? 'N/A'
        } | baths: ${prop.bathrooms ?? 'N/A'} | similarity: ${prop.similarity_score.toFixed(4)}`
      )
    })

    console.log(`Total results shown: ${results.length}`)
  } catch (error: any) {
    console.error('❌ Error during test:', error?.message || error)
  }
}

async function main() {
  console.log('🚀 Running RAG semantic search tests...')

  const supabase = getSupabaseClient()

  // 1. 3 bedroom house under 500K
  await runSearchTest(supabase, '3 bedroom house under 500K', {
    query: '3 bedroom house under 500K',
    minBeds: 3,
    maxPrice: 500000,
  })

  // 2. Luxury condo with pool in Miami
  await runSearchTest(supabase, 'luxury condo with pool in Miami', {
    query: 'luxury condo with pool in Miami',
    location: 'Miami',
    propertyType: 'condo',
  })

  // 3. Family home near good schools
  await runSearchTest(supabase, 'family home near good schools', {
    query: 'family home near highly rated school district',
  })

  // 4. Modern house with garage
  await runSearchTest(supabase, 'modern house with garage', {
    query: 'modern single-family home with attached garage',
  })

  console.log('\n✅ RAG tests completed. Review output above to verify result quality.')
}

main().catch((error) => {
  console.error('Unexpected error in test-rag script:', error)
  process.exit(1)
})

