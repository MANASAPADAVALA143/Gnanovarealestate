/**
 * Property Management API
 * 
 * Handles property CRUD operations, CSV upload, and embedding generation
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { generatePropertyEmbedding, generateBatchEmbeddings } from '../lib/rag-search'

/**
 * Express/webhook-server must use the service role — the Vite anon client has no JWT,
 * so RLS on properties INSERT (agent_id = auth.uid()) always fails from this path.
 */
function getDb(): SupabaseClient {
  const url =
    (typeof process !== 'undefined' &&
      (process.env.SUPABASE_URL ||
        process.env.NEXT_PUBLIC_SUPABASE_URL ||
        process.env.VITE_SUPABASE_URL)) ||
    ''
  const serviceKey =
    (typeof process !== 'undefined' &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)) ||
    ''

  if (url && serviceKey) {
    return createClient(url, serviceKey)
  }

  if (!supabase) {
    throw new Error('Supabase client not initialized')
  }
  return supabase as unknown as SupabaseClient
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
  image_url?: string | null
  virtual_tour_url?: string
  status?: string
  embedding?: number[]
  /** Read-only generated column — never send on insert */
  price_per_sqm?: number | null
  handover_quarter?: string | null
  is_freehold?: boolean | null
  district_stage?: 1 | 2 | 3 | 4 | null
  developer_track_record?: string | null
  completion_status?: 'off_plan' | 'ready' | 'under_construction' | null
  service_charge?: number | null
  rera_permit?: string | null
  parking_spaces?: number | null
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
        const { error } = await getDb()
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
    let query = getDb().from('properties').select('*')

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
    const { error } = await getDb()
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
    const raw = property as Property & { agentId?: string }
    const {
      agentId: _agentIdCamel,
      price_per_sqm: _generated,
      embedding: _emb,
      id: _id,
      ...rest
    } = raw

    const row: Record<string, unknown> = {
      ...rest,
      agent_id: agentId || rest.agent_id || undefined,
      handover_quarter: rest.handover_quarter?.trim() || null,
      developer_track_record: rest.developer_track_record?.trim() || null,
      is_freehold: rest.is_freehold ?? true,
      district_stage: rest.district_stage ?? null,
      image_url: rest.image_url?.trim?.() || rest.image_url || null,
      completion_status: rest.completion_status || null,
      service_charge:
        rest.service_charge != null && rest.service_charge !== ('' as unknown)
          ? Number(rest.service_charge)
          : null,
      rera_permit: rest.rera_permit?.trim?.() || rest.rera_permit || null,
      parking_spaces:
        rest.parking_spaces != null && rest.parking_spaces !== ('' as unknown)
          ? Number(rest.parking_spaces)
          : null,
    }
    delete row.agentId
    if (row.image_url && (!row.photos || !(row.photos as string[]).length)) {
      row.photos = [row.image_url as string]
    }

    // Generate embedding
    try {
      row.embedding = await generatePropertyEmbedding(rest as Property)
    } catch (embError: any) {
      console.warn(`⚠️ Could not generate embedding: ${embError.message}`)
    }

    const { data, error } = await getDb()
      .from('properties')
      .insert(row)
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
