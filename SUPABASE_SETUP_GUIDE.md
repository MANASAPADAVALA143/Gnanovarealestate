# 🗄️ Supabase Setup Guide

## Step-by-Step Instructions

### **Step 1: Open Supabase Dashboard**

1. Go to: https://supabase.com/dashboard
2. Sign in to your account
3. Click on your project: **mhdnoufdloigblgcypjl**

---

### **Step 2: Open SQL Editor**

1. In the left sidebar, click **"SQL Editor"**
2. Click **"New Query"** button (top right)

---

### **Step 3: Run Migration #1 - Enable pgvector & Create Properties Table**

Copy and paste this **ENTIRE** SQL code into the SQL Editor:

```sql
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
```

3. Click **"Run"** button (or press `Ctrl+Enter` / `Cmd+Enter`)
4. Wait for success message: ✅ **"Success. No rows returned"**

---

### **Step 4: Run Migration #2 - Create Bookings Table**

**IMPORTANT:** Make sure you already have a `leads` table. If you don't, run this first:

```sql
-- Create leads table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text NOT NULL,
  location text,
  budget text,
  property_type text,
  status text DEFAULT 'new',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

Then run the bookings migration:

```sql
-- Bookings table for scheduled property viewings
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  scheduled_date date not null,
  scheduled_time time not null,
  status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now()
);
```

Click **"Run"** and wait for success.

---

### **Step 5: Verify Everything Works**

1. Go to **"Table Editor"** in the left sidebar
2. You should see these tables:
   - ✅ `properties` (should be empty for now)
   - ✅ `bookings` (should be empty)
   - ✅ `leads` (may have data)

3. Click on **`properties`** table
4. Check that it has these columns:
   - `id`, `address`, `city`, `price`, `bedrooms`, etc.
   - **`embedding`** (type: `vector`) ← This is important!
   - **`metadata`** (type: `jsonb`)

---

### **Step 6: Test from Your Computer**

Go back to your terminal and run:

```bash
npm run verify
```

You should see:
- ✅ **Database connection works**
- ✅ **Properties table exists**

---

## ✅ **What You Just Created:**

1. **`pgvector` extension** - Enables vector storage
2. **`properties` table** - Stores property data with embeddings
3. **`search_properties()` function** - For semantic property search
4. **`bookings` table** - For scheduling property viewings

---

## 🚨 **Common Issues:**

### **Issue 1: "extension vector does not exist"**
- **Fix:** Your Supabase project might not have pgvector enabled. Contact Supabase support or check your project settings.

### **Issue 2: "relation leads does not exist"**
- **Fix:** Run the `leads` table creation SQL from Step 4 first.

### **Issue 3: "permission denied"**
- **Fix:** Make sure you're using the SQL Editor (not a restricted user). You need admin access.

---

## 🎯 **Next Steps After This:**

1. ✅ **Add OpenAI API key** to `.env.local`
2. ✅ **Run:** `npm run load-properties` (loads 50 sample properties)
3. ✅ **Test:** `npm run test-rag` (tests property search)

---

## 📸 **Visual Guide:**

1. **SQL Editor** → Click "New Query"
2. **Paste SQL** → Copy entire migration
3. **Click "Run"** → Wait for success
4. **Table Editor** → Verify tables exist

---

**Done!** 🎉 Your database is now ready for RAG property search!
