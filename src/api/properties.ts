/**
 * Property Management API
 * 
 * Handles property CRUD operations, CSV upload, and embedding generation
 */

import { supabase } from '../lib/supabase'
import { generatePropertyEmbedding, generateBatchEmbeddings } from '../lib/rag-search'

// Get Supabase client - handles both lazy proxy and direct client
function getClient() {
  if (!supabase) {
    throw new Error('Supabase client not initialized')
  }
  return supabase
}

export interface Property {
  id?: string
  agent_id?: string
  title?: string
  address: string
  city: string
  state?: string
  country?: string
  zip_code?: string
  price: number
  bedrooms: number
  bathrooms: number
  sqft?: number
  property_type?: string
  amenities?: string[] | string
  description?: string
  photos?: string[]
  virtual_tour_url?: string
  status?: string
  embedding?: number[]
}

/**
 * Parse CSV text to array of properties
 */
export function parseCSV(csvText: string): Property[] {
  const lines = csvText.trim().split('\n')
  if (lines.length < 2) {
    throw new Error('CSV must have at least a header and one data row')
  }

  // Parse header
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase())

  // Parse rows
  const properties: Property[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim())
    
    if (values.length !== headers.length) {
      console.warn(`Skipping malformed row ${i + 1}`)
      continue
    }

    const property: any = {}

    headers.forEach((header, index) => {
      const value = values[index]

      switch (header) {
        case 'title':
          property.title = value
          break
        case 'address':
          property.address = value
          break
        case 'city':
          property.city = value
          break
        case 'state':
          property.state = value
          break
        case 'country':
          property.country = value || 'USA'
          break
        case 'zip_code':
        case 'zipcode':
          property.zip_code = value
          break
        case 'price':
          property.price = parseFloat(value.replace(/[$,]/g, '')) || 0
          break
        case 'bedrooms':
        case 'beds':
          property.bedrooms = parseInt(value) || 0
          break
        case 'bathrooms':
        case 'baths':
          property.bathrooms = parseFloat(value) || 0
          break
        case 'sqft':
        case 'square_feet':
          property.sqft = parseInt(value) || null
          break
        case 'property_type':
        case 'type':
          property.property_type = value
          break
        case 'amenities':
          // Handle comma-separated amenities within quotes
          property.amenities = value ? value.split(';').map(a => a.trim()) : []
          break
        case 'description':
          property.description = value
          break
        case 'virtual_tour_url':
        case 'tour_url':
          property.virtual_tour_url = value
          break
        case 'status':
          property.status = value || 'active'
          break
        case 'photos':
          // Handle semicolon-separated photo URLs
          property.photos = value ? value.split(';').map(p => p.trim()) : []
          break
      }
    })

    // Validate required fields
    if (property.address && property.city && property.price) {
      properties.push(property)
    } else {
      console.warn(`Skipping row ${i + 1}: missing required fields (address, city, price)`)
    }
  }

  return properties
}

/**
 * Upload properties from CSV
 */
export async function uploadPropertiesFromCSV(
  csvText: string,
  agentId?: string
): Promise<{ success: boolean; count: number; errors: string[] }> {
  try {
    const properties = parseCSV(csvText)
    const errors: string[] = []
    let successCount = 0

    console.log(`📤 Uploading ${properties.length} properties from CSV...`)

    for (const property of properties) {
      try {
        // Add agent_id if provided
        if (agentId) {
          property.agent_id = agentId
        }

        // SKIP embedding generation during upload - do it separately later
        // This avoids OpenAI quota errors blocking property upload
        property.embedding = null

        // Insert property
        const { error } = await supabase
          .from('properties')
          .insert(property)

        if (error) {
          errors.push(`Failed to insert ${property.address}: ${error.message}`)
          console.error(`❌ Insert error for ${property.address}:`, error.message)
        } else {
          successCount++
        }
      } catch (error: any) {
        errors.push(`Error processing ${property.address}: ${error.message}`)
        console.error(`❌ Processing error for ${property.address}:`, error.message)
      }
    }

    console.log(`✅ Successfully uploaded ${successCount}/${properties.length} properties`)

    return {
      success: successCount > 0,
      count: successCount,
      errors,
    }
  } catch (error: any) {
    console.error('❌ CSV upload error:', error.message)
    throw new Error(`CSV upload failed: ${error.message}`)
  }
}

/**
 * Get all properties for an agent
 */
export async function getProperties(filters?: {
  agentId?: string
  city?: string
  minPrice?: number
  maxPrice?: number
  bedrooms?: number
  status?: string
}): Promise<Property[]> {
  try {
    let query = supabase.from('properties').select('*')

    if (filters?.agentId) {
      query = query.eq('agent_id', filters.agentId)
    }

    if (filters?.city) {
      query = query.ilike('city', `%${filters.city}%`)
    }

    if (filters?.minPrice) {
      query = query.gte('price', filters.minPrice)
    }

    if (filters?.maxPrice) {
      query = query.lte('price', filters.maxPrice)
    }

    if (filters?.bedrooms) {
      query = query.eq('bedrooms', filters.bedrooms)
    }

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    query = query.order('created_at', { ascending: false })

    const { data, error } = await query

    if (error) throw error

    return data || []
  } catch (error: any) {
    console.error('❌ Get properties error:', error.message)
    throw new Error(`Failed to fetch properties: ${error.message}`)
  }
}

/**
 * Delete a property
 */
export async function deleteProperty(propertyId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('properties')
      .delete()
      .eq('id', propertyId)

    if (error) throw error

    console.log(`✅ Property ${propertyId} deleted`)
    return true
  } catch (error: any) {
    console.error('❌ Delete property error:', error.message)
    throw new Error(`Failed to delete property: ${error.message}`)
  }
}

/**
 * Create a single property
 */
export async function createProperty(property: Property, agentId?: string): Promise<string> {
  try {
    if (agentId) {
      property.agent_id = agentId
    }

    // Generate embedding
    try {
      property.embedding = await generatePropertyEmbedding(property)
    } catch (embError: any) {
      console.warn(`⚠️ Could not generate embedding: ${embError.message}`)
    }

    const { data, error } = await supabase
      .from('properties')
      .insert(property)
      .select()
      .single()

    if (error) throw error

    console.log(`✅ Property created: ${data.id}`)
    return data.id
  } catch (error: any) {
    console.error('❌ Create property error:', error.message)
    throw new Error(`Failed to create property: ${error.message}`)
  }
}

/**
 * Generate embeddings for properties without them
 */
export async function embedProperties(propertyIds?: string[]): Promise<number> {
  try {
    const count = await generateBatchEmbeddings(propertyIds)
    return count
  } catch (error: any) {
    console.error('❌ Embed properties error:', error.message)
    throw new Error(`Failed to generate embeddings: ${error.message}`)
  }
}
