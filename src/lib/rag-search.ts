/**
 * RAG Property Search
 * 
 * Uses OpenAI embeddings + pgvector for semantic property search
 */

import OpenAI from 'openai'
import { supabase } from './supabase'

// Lazy initialization of OpenAI client (only create when needed)
let openaiClient: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY or VITE_OPENAI_API_KEY environment variable.')
    }
    openaiClient = new OpenAI({ apiKey })
  }
  return openaiClient
}

export interface PropertySearchResult {
  id: string
  title?: string
  address: string
  city: string
  state?: string
  country?: string
  price: number
  bedrooms: number
  bathrooms: number
  sqft?: number
  property_type?: string
  amenities?: string[]
  description?: string
  photos?: string[]
  virtual_tour_url?: string
  status: string
  similarity: number
}

/**
 * Search properties using RAG (semantic search)
 * 
 * @param query - Natural language query (e.g., "3 bed in Dubai under 500K")
 * @param matchCount - Number of results to return (default: 5)
 * @returns Array of matching properties with similarity scores
 */
export async function searchProperties(
  query: string,
  matchCount: number = 5
): Promise<PropertySearchResult[]> {
  try {
    console.log('🔍 RAG Search Query:', query)

    // 1. Convert query to embedding using OpenAI
    const embeddingResponse = await getOpenAIClient().embeddings.create({
      model: 'text-embedding-ada-002',
      input: query,
    })

    const queryEmbedding = embeddingResponse.data[0].embedding

    console.log('✅ Query embedding generated')

    // 2. Search pgvector for closest matches
    const { data, error } = await supabase.rpc('search_properties', {
      query_embedding: queryEmbedding,
      match_count: matchCount,
    })

    if (error) {
      console.error('❌ Supabase search error:', error)
      throw error
    }

    console.log(`✅ Found ${data?.length || 0} matching properties`)

    return data || []
  } catch (error: any) {
    console.error('❌ RAG search error:', error.message)
    throw new Error(`Property search failed: ${error.message}`)
  }
}

/**
 * Generate embedding for a single property
 * 
 * @param property - Property data
 * @returns Embedding vector
 */
export async function generatePropertyEmbedding(property: {
  title?: string
  address?: string
  city?: string
  state?: string
  country?: string
  price?: number
  bedrooms?: number
  bathrooms?: number
  sqft?: number
  property_type?: string
  amenities?: string[] | string
  description?: string
}): Promise<number[]> {
  try {
    // Create text representation of property
    const amenitiesText = Array.isArray(property.amenities)
      ? property.amenities.join(', ')
      : property.amenities || ''

    const text = `
      ${property.title || ''} 
      ${property.address || ''} 
      ${property.city || ''} 
      ${property.state || ''} 
      ${property.country || ''} 
      $${property.price || ''} 
      ${property.bedrooms || ''} bedrooms 
      ${property.bathrooms || ''} bathrooms 
      ${property.sqft || ''} sqft 
      ${property.property_type || ''} 
      ${amenitiesText} 
      ${property.description || ''}
    `.trim()

    console.log('📝 Generating embedding for property text')

    const response = await getOpenAIClient().embeddings.create({
      model: 'text-embedding-ada-002',
      input: text,
    })

    return response.data[0].embedding
  } catch (error: any) {
    console.error('❌ Embedding generation error:', error.message)
    throw new Error(`Failed to generate embedding: ${error.message}`)
  }
}

/**
 * Generate embeddings for multiple properties in batch
 * 
 * @param properties - Array of properties
 * @returns Count of properties embedded
 */
export async function generateBatchEmbeddings(propertyIds?: string[]): Promise<number> {
  try {
    // Fetch properties without embeddings
    let query = supabase
      .from('properties')
      .select('*')
      .is('embedding', null)

    if (propertyIds && propertyIds.length > 0) {
      query = query.in('id', propertyIds)
    }

    const { data: properties, error } = await query

    if (error) throw error

    if (!properties || properties.length === 0) {
      console.log('ℹ️ No properties need embeddings')
      return 0
    }

    console.log(`🔄 Generating embeddings for ${properties.length} properties...`)

    let successCount = 0

    // Generate embeddings one by one
    for (const property of properties) {
      try {
        const embedding = await generatePropertyEmbedding(property)

        // Update property with embedding
        const { error: updateError } = await supabase
          .from('properties')
          .update({ embedding })
          .eq('id', property.id)

        if (updateError) {
          console.error(`❌ Failed to update property ${property.id}:`, updateError)
        } else {
          successCount++
          console.log(`✅ Embedded property ${successCount}/${properties.length}`)
        }

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error: any) {
        console.error(`❌ Error embedding property ${property.id}:`, error.message)
      }
    }

    console.log(`✅ Successfully embedded ${successCount} properties`)

    return successCount
  } catch (error: any) {
    console.error('❌ Batch embedding error:', error.message)
    throw new Error(`Batch embedding failed: ${error.message}`)
  }
}
