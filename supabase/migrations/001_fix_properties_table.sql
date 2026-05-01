-- FIX: Drop and recreate properties table with all columns including embedding
-- Use this if your properties table is empty or you don't mind losing data

-- Step 1: Drop the incomplete table
DROP TABLE IF EXISTS public.properties CASCADE;

-- Step 2: Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 3: Create the complete properties table with ALL columns
CREATE TABLE public.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
  hoa_fee numeric NULL,
  school_district text,
  amenities text[] DEFAULT '{}',
  description text,
  photos text[] DEFAULT '{}',
  virtual_tour_url text NULL,
  listing_agent_name text,
  listing_agent_phone text,
  listing_agent_email text,
  status text DEFAULT 'active',
  listed_date timestamptz,
  updated_date timestamptz DEFAULT now(),
  -- OpenAI ada-002 has 1536 dimensions
  embedding vector(1536),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Step 4: Create vector index
CREATE INDEX properties_embedding_idx
  ON public.properties
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Step 5: Create search function
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
