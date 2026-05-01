-- FIX: Add missing columns to existing properties table
-- Use this if your properties table already has data you want to keep

-- Step 1: Enable pgvector extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Add missing columns
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS parking text,
  ADD COLUMN IF NOT EXISTS hoa_fee numeric NULL,
  ADD COLUMN IF NOT EXISTS school_district text,
  ADD COLUMN IF NOT EXISTS amenities text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS photos text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS virtual_tour_url text NULL,
  ADD COLUMN IF NOT EXISTS listing_agent_name text,
  ADD COLUMN IF NOT EXISTS listing_agent_phone text,
  ADD COLUMN IF NOT EXISTS listing_agent_email text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS listed_date timestamptz,
  ADD COLUMN IF NOT EXISTS updated_date timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS embedding vector(1536),
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Step 3: Create vector index (if it doesn't exist)
CREATE INDEX IF NOT EXISTS properties_embedding_idx
  ON public.properties
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Step 4: Create search function
CREATE OR REPLACE FUNCTION public.search_properties(
  query_embedding vector(1536),
  match_count integer DEFAULT 10,
  similarity_threshold double precision DEFAULT 0.0
)
RETURNS TABLE (
  id uuid,
  address text,
  city text,
  state text,
  zip_code text,
  price numeric,
  bedrooms integer,
  bathrooms numeric,
  sqft integer,
  property_type text,
  year_built integer,
  parking text,
  hoa_fee numeric,
  school_district text,
  amenities text[],
  description text,
  photos text[],
  virtual_tour_url text,
  listing_agent_name text,
  listing_agent_phone text,
  listing_agent_email text,
  status text,
  listed_date timestamptz,
  updated_date timestamptz,
  metadata jsonb,
  similarity double precision
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.id,
    p.address,
    p.city,
    p.state,
    p.zip_code,
    p.price,
    p.bedrooms,
    p.bathrooms,
    p.sqft,
    p.property_type,
    p.year_built,
    p.parking,
    p.hoa_fee,
    p.school_district,
    p.amenities,
    p.description,
    p.photos,
    p.virtual_tour_url,
    p.listing_agent_name,
    p.listing_agent_phone,
    p.listing_agent_email,
    p.status,
    p.listed_date,
    p.updated_date,
    p.metadata,
    1 - (p.embedding <=> query_embedding) AS similarity
  FROM public.properties AS p
  WHERE p.embedding IS NOT NULL
    AND (1 - (p.embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
$$;
