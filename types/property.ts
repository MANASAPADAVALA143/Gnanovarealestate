// Core property type matching the Supabase `public.properties` table
export type PropertyStatus = 'active' | 'pending' | 'sold' | 'off_market'

// Common real estate property types – DB stores these as text
export type PropertyType =
  | 'single_family'
  | 'condo'
  | 'townhouse'
  | 'apartment'
  | 'multi_family'
  | 'land'
  | 'commercial'
  | 'other'

export interface Property {
  id: string // uuid

  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null

  price: number | null
  bedrooms: number | null
  bathrooms: number | null
  sqft: number | null

  property_type: PropertyType | null
  year_built: number | null
  parking: string | null
  hoa_fee: number | null
  school_district: string | null

  amenities: string[] | null
  description: string | null
  photos: string[] | null
  virtual_tour_url: string | null

  listing_agent_name: string | null
  listing_agent_phone: string | null
  listing_agent_email: string | null

  status: PropertyStatus
  listed_date: string | null // ISO timestamptz
  updated_date: string // ISO timestamptz

  // Embedding is stored as a pgvector; in TypeScript we typically just
  // represent it as a number array when materialized into the app.
  embedding: number[] | null

  // Arbitrary extra metadata stored as jsonb in the DB
  metadata: Record<string, any> | null
}

// Filters for text + structured search over properties
export interface PropertySearchFilters {
  /**
   * Natural language query used for semantic search / RAG,
   * e.g. "3BHK apartment in Bangalore under 80L with covered parking".
   */
  query: string

  maxPrice?: number
  minPrice?: number
  minBeds?: number
  maxBeds?: number
  location?: string
  propertyType?: PropertyType
}

// Search result including similarity metadata from pgvector search
export interface PropertySearchResult extends Property {
  similarity_score: number
  rank: number
}

