-- Enable pgvector extension (for storing embeddings)
create extension if not exists vector;

-- Properties table with embedding column for semantic search
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
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
  hoa_fee numeric null,
  school_district text,
  amenities text[] default '{}',
  description text,
  photos text[] default '{}',
  virtual_tour_url text null,
  listing_agent_name text,
  listing_agent_phone text,
  listing_agent_email text,
  status text default 'active',
  listed_date timestamptz,
  updated_date timestamptz default now(),
  -- OpenAI ada-002 has 1536 dimensions
  embedding vector(1536),
  metadata jsonb default '{}'::jsonb
);

-- Vector index for fast similarity search
-- Note: ivfflat requires ANALYZE after populating data for best performance.
create index if not exists properties_embedding_idx
  on public.properties
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Similarity search function: returns top K most similar properties
-- Usage:
--   select *
--   from search_properties(
--     query_embedding := '[...]'::vector,
--     match_count := 10,
--     similarity_threshold := 0.0
--   );
create or replace function public.search_properties(
  query_embedding vector(1536),
  match_count integer default 10,
  similarity_threshold double precision default 0.0
)
returns table (
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
language sql
stable
as $$
  select
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
    1 - (p.embedding <=> query_embedding) as similarity
  from public.properties as p
  where p.embedding is not null
    and (1 - (p.embedding <=> query_embedding)) >= similarity_threshold
  order by p.embedding <=> query_embedding
  limit match_count;
$$;

