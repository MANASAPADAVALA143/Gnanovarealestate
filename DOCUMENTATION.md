# 📚 Gnanova Real Estate AI Assistant - Documentation

**Version:** 1.0.0  
**Last Updated:** 2026-01-15

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [API Reference](#3-api-reference)
4. [RAG System](#4-rag-system)
5. [VAPI Integration](#5-vapi-integration)
6. [Development Setup](#6-development-setup)
7. [Deployment Guide](#7-deployment-guide)
8. [Common Issues & Solutions](#8-common-issues--solutions)

---

## 1. Project Overview

### What is Gnanova?

Gnanova is an AI-powered real estate assistant that automates lead qualification, property matching, and follow-up communication. It combines:

- **AI Voice Calls** - Automated phone calls that qualify leads in real-time
- **RAG Property Search** - Semantic search using vector embeddings to find matching properties
- **WhatsApp Integration** - Automated property sharing via WhatsApp
- **Smart Recommendations** - AI-driven property recommendations based on lead preferences

### Key Features

- ✅ **Instant Lead Response** - AI calls new leads within 2 minutes
- ✅ **Natural Language Property Search** - "3 bedroom house under 500K" finds relevant matches
- ✅ **24/7 Availability** - Never miss a lead, even after hours
- ✅ **Multi-Channel Follow-up** - Voice calls, WhatsApp, and email
- ✅ **Lead Qualification** - Automatic scoring and prioritization
- ✅ **Property Matching** - RAG-based semantic search finds best matches
- ✅ **Booking Management** - Automated appointment scheduling

### Technology Stack

**Frontend:**
- React 18 + TypeScript
- Vite (or Next.js)
- Tailwind CSS
- React Router

**Backend:**
- Next.js API Routes (or Express.js)
- Node.js 18+
- TypeScript

**Database:**
- Supabase (PostgreSQL)
- pgvector extension (vector similarity search)

**AI/ML:**
- OpenAI (embeddings: `text-embedding-ada-002`)
- VAPI (voice AI calls)
- LangChain (RAG framework - optional)

**Integrations:**
- Twilio (WhatsApp messaging)
- VAPI (voice AI)
- n8n (workflow automation - optional)

**Deployment:**
- Vercel (frontend + API)
- Supabase (database)

---

## 2. Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        User/Lead                              │
└───────────────────────┬─────────────────────────────────────┘
                         │
                         │ 1. Submits Lead Form
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Landing Page (React)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Lead Form    │  │ Property     │  │ Dashboard   │      │
│  │              │  │ Search       │  │ Analytics    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└───────────────────────┬─────────────────────────────────────┘
                         │
                         │ 2. POST /api/leads/create
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Express/Next.js API Server                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Lead API     │  │ Property     │  │ VAPI         │      │
│  │              │  │ Search API   │  │ Functions    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└───────┬───────────────────┬───────────────────┬─────────────┘
        │                   │                   │
        │ 3. Save Lead      │ 4. Vector Search │ 5. Function Call
        ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    Supabase (PostgreSQL)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ leads        │  │ properties   │  │ bookings     │      │
│  │              │  │ (with        │  │              │      │
│  │              │  │  embeddings) │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  pgvector extension for vector similarity search            │
└───────────────────────┬─────────────────────────────────────┘
                         │
                         │ 6. Trigger VAPI Call
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      VAPI (Voice AI)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ AI Assistant │  │ Function     │  │ Webhook      │      │
│  │              │  │ Calling      │  │ Handler      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└───────────────────────┬─────────────────────────────────────┘
                         │
                         │ 7. Call Lead's Phone
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Lead Receives Call                        │
│  • AI qualifies lead                                         │
│  • Searches properties via function call                    │
│  • Books viewing if interested                              │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow: Lead → Call → Search → Recommendation

```
1. LEAD SUBMISSION
   └─> POST /api/leads/create
       └─> Save to Supabase (leads table)
           └─> Trigger n8n webhook (optional)
               └─> Initiate VAPI call

2. AI CALL INITIATION
   └─> VAPI calls lead's phone number
       └─> AI assistant greets and qualifies
           └─> Lead mentions: "I want a 3 bedroom house under 500K"

3. PROPERTY SEARCH (RAG)
   └─> VAPI calls function: search_properties
       └─> POST /api/vapi/functions
           └─> Generate query embedding (OpenAI)
               └─> Vector similarity search (Supabase pgvector)
                   └─> Filter by price/bedrooms
                       └─> Return top 5 matches
                           └─> Format for speech
                               └─> AI speaks results to lead

4. PROPERTY RECOMMENDATION
   └─> After call, POST /api/properties/recommend
       └─> Build query from lead preferences
           └─> RAG search for top 5 properties
               └─> Save recommendations to database
                   └─> Send via WhatsApp (optional)
                       └─> Email summary (optional)

5. BOOKING
   └─> Lead requests viewing
       └─> POST /api/bookings/create
           └─> Save booking to database
               └─> Send confirmation email
                   └─> Notify agent
```

### Database Schema

#### Core Tables

**`leads`**
```sql
CREATE TABLE leads (
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

**`properties`**
```sql
CREATE TABLE properties (
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
  hoa_fee numeric,
  school_district text,
  amenities text[] DEFAULT '{}',
  description text,
  photos text[] DEFAULT '{}',
  virtual_tour_url text,
  listing_agent_name text,
  listing_agent_phone text,
  listing_agent_email text,
  status text DEFAULT 'active',
  listed_date timestamptz,
  updated_date timestamptz DEFAULT now(),
  embedding vector(1536),  -- OpenAI ada-002 embedding
  metadata jsonb DEFAULT '{}'::jsonb
);
```

**`bookings`**
```sql
CREATE TABLE bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id),
  lead_id uuid REFERENCES leads(id),
  scheduled_date date NOT NULL,
  scheduled_time time NOT NULL,
  status text DEFAULT 'pending',
  notes text,
  created_at timestamptz DEFAULT now()
);
```

**`calls`**
```sql
CREATE TABLE calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id),
  status text,
  outcome text,
  duration integer,
  transcript text,
  recording_url text,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```

#### Indexes

```sql
-- Vector similarity search index
CREATE INDEX properties_embedding_idx
  ON properties
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Performance indexes
CREATE INDEX idx_properties_city ON properties(city);
CREATE INDEX idx_properties_price ON properties(price);
CREATE INDEX idx_properties_bedrooms ON properties(bedrooms);
CREATE INDEX idx_leads_phone ON leads(phone);
CREATE INDEX idx_bookings_lead_id ON bookings(lead_id);
```

---

## 3. API Reference

### Base URL

- **Development:** `http://localhost:3000` (Next.js) or `http://localhost:3001` (Express)
- **Production:** `https://yourdomain.com`

### Authentication

Most endpoints use Supabase service role key (server-side only). Some endpoints may require API key in headers:

```bash
# Example with API key
curl -H "X-API-Key: your-api-key" \
     -H "Content-Type: application/json" \
     https://yourdomain.com/api/endpoint
```

---

### Lead Management

#### Create Lead

**POST** `/api/leads/create`

Creates a new lead and optionally triggers an AI call.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "location": "Miami, FL",
  "timeline": "Within 30 days",
  "source": "website"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Lead captured. AI will call within 2 minutes.",
  "leadId": "uuid-here"
}
```

**Example:**
```bash
curl -X POST http://localhost:3001/api/leads/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "location": "Miami, FL",
    "timeline": "Within 30 days"
  }'
```

---

### Property Search (RAG)

#### Search Properties

**POST** `/api/properties/search`

Performs semantic property search using vector embeddings.

**Request Body:**
```json
{
  "query": "3 bedroom house under 500K",
  "maxPrice": 500000,
  "minPrice": 200000,
  "minBeds": 3,
  "maxBeds": 4,
  "location": "Miami",
  "propertyType": "single_family"
}
```

**Response:**
```json
{
  "success": true,
  "properties": [
    {
      "id": "uuid",
      "address": "123 Main St",
      "city": "Miami",
      "state": "FL",
      "price": 450000,
      "bedrooms": 3,
      "bathrooms": 2,
      "sqft": 1800,
      "similarity_score": 0.87,
      "rank": 1
    }
  ],
  "query": "3 bedroom house under 500K",
  "resultsCount": 5
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/properties/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "3 bedroom house under 500K",
    "maxPrice": 500000,
    "minBeds": 3
  }'
```

---

#### Get Property Details

**GET** `/api/properties/[id]`

Retrieves full details of a specific property and finds similar properties.

**Response:**
```json
{
  "success": true,
  "property": {
    "id": "uuid",
    "address": "123 Main St",
    "city": "Miami",
    "state": "FL",
    "price": 450000,
    "bedrooms": 3,
    "bathrooms": 2,
    "sqft": 1800,
    "description": "Beautiful home...",
    "photos": ["url1", "url2"],
    "virtual_tour_url": "https://...",
    "listing_agent_name": "Jane Smith",
    "listing_agent_phone": "+1234567890",
    "listing_agent_email": "jane@example.com"
  },
  "similarProperties": [
    {
      "id": "uuid-2",
      "address": "456 Oak Ave",
      "similarity_score": 0.82
    }
  ]
}
```

**Example:**
```bash
curl http://localhost:3000/api/properties/uuid-here
```

---

#### Recommend Properties

**POST** `/api/properties/recommend`

Automatically recommends properties based on lead preferences.

**Request Body:**
```json
{
  "leadId": "lead-uuid",
  "preferences": {
    "budget_max": 500000,
    "bedrooms": 3,
    "location": "Miami",
    "must_have": ["pool", "garage"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "properties": [...],
  "summary": "I found 5 great properties matching your criteria..."
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/properties/recommend \
  -H "Content-Type: application/json" \
  -d '{
    "leadId": "lead-uuid",
    "preferences": {
      "budget_max": 500000,
      "bedrooms": 3,
      "location": "Miami"
    }
  }'
```

---

### VAPI Integration

#### Handle VAPI Function Calls

**POST** `/api/vapi/functions`

Handles function calls from VAPI during voice conversations.

**Request Body (from VAPI):**
```json
{
  "message": {
    "type": "function-call",
    "functionCall": {
      "name": "search_properties",
      "parameters": {
        "query": "3 bedroom house under 500K",
        "max_price": 500000,
        "min_beds": 3
      }
    }
  }
}
```

**Response:**
```json
{
  "result": "I found 3 great properties! The best match is a beautiful 3-bedroom home at 123 Main St in Miami for $450,000..."
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/vapi/functions \
  -H "Content-Type: application/json" \
  -H "x-vapi-signature: your-secret" \
  -d '{
    "message": {
      "type": "function-call",
      "functionCall": {
        "name": "search_properties",
        "parameters": {
          "query": "3 bedroom house",
          "max_price": 500000
        }
      }
    }
  }'
```

---

### WhatsApp Integration

#### Send Property via WhatsApp

**POST** `/api/whatsapp/send-property`

Sends property details via WhatsApp using Twilio.

**Request Body:**
```json
{
  "phone": "+1234567890",
  "propertyIds": ["prop-uuid-1", "prop-uuid-2"],
  "leadName": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "messageSid": "SM1234567890",
  "message": "Property details sent successfully"
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/whatsapp/send-property \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+1234567890",
    "propertyIds": ["prop-uuid-1"],
    "leadName": "John Doe"
  }'
```

---

### Booking Management

#### Create Booking

**POST** `/api/bookings/create`

Creates a property viewing appointment.

**Request Body:**
```json
{
  "propertyId": "prop-uuid",
  "leadId": "lead-uuid",
  "preferredDate": "2026-02-15",
  "preferredTime": "2:00 PM",
  "notes": "Interested in seeing the backyard"
}
```

**Response:**
```json
{
  "success": true,
  "booking": {
    "id": "booking-uuid",
    "property_id": "prop-uuid",
    "lead_id": "lead-uuid",
    "scheduled_date": "2026-02-15",
    "scheduled_time": "14:00:00",
    "status": "pending"
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/bookings/create \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": "prop-uuid",
    "leadId": "lead-uuid",
    "preferredDate": "2026-02-15",
    "preferredTime": "2:00 PM"
  }'
```

---

### Analytics

#### Get Dashboard Stats

**GET** `/api/analytics/stats`

Returns dashboard analytics (cached for 5 minutes).

**Response:**
```json
{
  "today": {
    "calls": 15,
    "hotLeads": 5,
    "appointmentsBooked": 3,
    "avgLeadScore": 72
  },
  "thisWeek": {
    "calls": 87,
    "hotLeads": 28,
    "appointmentsBooked": 12,
    "conversionRate": 0.14
  },
  "topProperties": [
    {
      "id": "uuid",
      "address": "123 Main St",
      "inquiryCount": 12
    }
  ],
  "recentActivity": [
    {
      "type": "call",
      "timestamp": "2026-01-15T10:30:00Z",
      "description": "Call with John Doe"
    }
  ]
}
```

**Example:**
```bash
curl http://localhost:3000/api/analytics/stats
```

---

## 4. RAG System

### How Property Search Works

The RAG (Retrieval Augmented Generation) system uses semantic search to find properties based on natural language queries.

#### Step-by-Step Process

1. **Query Embedding**
   - User query: "3 bedroom house under 500K"
   - Generate 1536-dimensional vector using OpenAI `text-embedding-ada-002`
   - Vector represents semantic meaning of the query

2. **Vector Similarity Search**
   - Compare query embedding with all property embeddings in database
   - Use cosine similarity: `1 - (embedding1 <=> embedding2)`
   - pgvector `<=>` operator computes cosine distance

3. **Filtering**
   - Apply structured filters (price, bedrooms, location)
   - Sort by similarity score
   - Return top 5 matches

4. **Result Formatting**
   - Format for display or speech
   - Include similarity scores for transparency

### Embedding Generation

#### Property Embedding

Properties are embedded when loaded into the database:

```typescript
import { generatePropertyEmbedding } from './lib/embeddings'

const property: Property = {
  address: "123 Main St",
  city: "Miami",
  price: 450000,
  bedrooms: 3,
  description: "Beautiful home with pool...",
  amenities: ["pool", "garage"]
}

const embedding = await generatePropertyEmbedding(property)
// Returns: [0.123, -0.456, ..., 0.789] (1536 dimensions)
```

**Embedding Text Format:**
```
"123 Main St in Miami, FL. $450,000. 3 bed, 2 bath. 1800 sqft. 
Beautiful home with pool and garage. Amenities: pool, garage. 
School district: Miami-Dade County."
```

#### Query Embedding

Search queries are embedded on-the-fly:

```typescript
import { generateQueryEmbedding } from './lib/embeddings'

const query = "3 bedroom house under 500K"
const embedding = await generateQueryEmbedding(query)
```

### Vector Similarity Search

#### SQL Function

The `search_properties` function performs the vector search:

```sql
SELECT
  p.*,
  1 - (p.embedding <=> query_embedding) as similarity
FROM properties p
WHERE p.embedding IS NOT NULL
  AND (1 - (p.embedding <=> query_embedding)) >= similarity_threshold
ORDER BY p.embedding <=> query_embedding
LIMIT match_count;
```

#### Index Optimization

The `ivfflat` index speeds up similarity search:

```sql
CREATE INDEX properties_embedding_idx
  ON properties
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

**Important:** Run `ANALYZE properties;` after loading data for optimal performance.

### Performance Optimization Tips

1. **Index Tuning**
   - Adjust `lists` parameter based on dataset size
   - Rule of thumb: `lists = rows / 1000` (min 10, max 1000)
   - Rebuild index after major data changes

2. **Similarity Threshold**
   - Use threshold ≥ 0.7 for high-quality results
   - Lower threshold (0.5-0.7) for broader matches
   - Filter out low-similarity results in application code

3. **Batch Embedding Generation**
   - Generate embeddings in batches (64 at a time)
   - Add rate limiting delays (250ms between batches)
   - Cache embeddings to avoid regeneration

4. **Query Optimization**
   - Request more results from DB (e.g., 30), filter in app
   - Use structured filters (price, bedrooms) to reduce vector search space
   - Cache frequent queries

5. **Database Performance**
   - Monitor query execution time: `EXPLAIN ANALYZE`
   - Ensure `ANALYZE` is run regularly
   - Consider partitioning for very large datasets (>100K properties)

### Example: Complete RAG Flow

```typescript
// 1. User query
const query = "luxury condo with pool in Miami"

// 2. Generate embedding
const embedding = await generateQueryEmbedding(query)

// 3. Vector search
const { data } = await supabase.rpc('search_properties', {
  query_embedding: embedding,
  match_count: 30,
  similarity_threshold: 0.7
})

// 4. Apply filters
const filtered = data.filter(p => 
  p.price <= 1000000 && 
  p.city === 'Miami' &&
  p.amenities?.includes('pool')
)

// 5. Return top 5
return filtered.slice(0, 5)
```

---

## 5. VAPI Integration

### How Voice Calls Work

1. **Lead Submission** → Triggers VAPI call via webhook
2. **VAPI Initiates Call** → Calls lead's phone number
3. **AI Conversation** → Qualifies lead, asks about preferences
4. **Function Calling** → AI calls `search_properties` when needed
5. **Results Spoken** → AI speaks property matches naturally
6. **Call Completion** → Webhook updates database with transcript

### Function Calling Flow

```
┌─────────────┐
│ VAPI Call   │
│ (AI speaks) │
└──────┬──────┘
       │
       │ Lead: "Show me 3 bedroom homes under 500K"
       ▼
┌─────────────────────┐
│ VAPI Function Call  │
│ search_properties   │
└──────┬──────────────┘
       │
       │ POST /api/vapi/functions
       ▼
┌─────────────────────┐
│ Function Handler    │
│ 1. Validate request │
│ 2. Normalize params │
│ 3. Call search API  │
│ 4. Format for speech│
└──────┬──────────────┘
       │
       │ Returns: "I found 3 great properties..."
       ▼
┌─────────────┐
│ VAPI       │
│ (AI speaks)│
└────────────┘
```

### Webhook Handling

VAPI sends webhooks for various events:

**Function Call Webhook:**
```json
{
  "message": {
    "type": "function-call",
    "functionCall": {
      "name": "search_properties",
      "parameters": {
        "query": "3 bedroom house",
        "max_price": 500000
      }
    }
  }
}
```

**Status Update Webhook:**
```json
{
  "type": "status-update",
  "status": "ended",
  "call": {
    "id": "call-id",
    "duration": 120,
    "transcript": "Full conversation transcript..."
  }
}
```

### Configuration

**VAPI Assistant Setup:**

1. Create assistant in VAPI dashboard
2. Set system prompt:
   ```
   You are a helpful real estate assistant. When leads ask about properties,
   use the search_properties function to find matches. Always speak naturally
   and highlight key features like price, bedrooms, and location.
   ```
3. Add functions:
   - `search_properties` → `https://yourdomain.com/api/vapi/functions`
   - `get_property_details` → `https://yourdomain.com/api/vapi/functions`
4. Set webhook URL: `https://yourdomain.com/api/vapi/webhook`

### Troubleshooting

**Issue: Function calls not working**

- ✅ Check webhook URL is correct in VAPI dashboard
- ✅ Verify `VAPI_SERVER_SECRET` matches in both places
- ✅ Check function names match exactly
- ✅ Review VAPI logs in dashboard

**Issue: AI doesn't call functions**

- ✅ Update system prompt to explicitly mention function usage
- ✅ Test function calling in VAPI playground
- ✅ Check function parameters are valid JSON

**Issue: Calls failing to initiate**

- ✅ Verify `VAPI_API_KEY` is correct
- ✅ Check phone number format: `+1234567890`
- ✅ Ensure phone number is verified in VAPI
- ✅ Review VAPI account credits/limits

**Issue: Webhook not receiving events**

- ✅ Check webhook URL is publicly accessible
- ✅ Verify SSL certificate is valid
- ✅ Test webhook with VAPI webhook tester
- ✅ Check server logs for incoming requests

---

## 6. Development Setup

### Prerequisites

- Node.js 18+ and npm
- Supabase account
- OpenAI API key
- VAPI account (for voice calls)
- Twilio account (for WhatsApp)
- Git

### Installation Steps

1. **Clone Repository**
   ```bash
   git clone https://github.com/yourusername/gnanova.git
   cd gnanova
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Set Up Environment Variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` with your credentials:
   ```env
   # Supabase
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   
   # OpenAI
   OPENAI_API_KEY=sk-...
   
   # VAPI
   VAPI_API_KEY=your-vapi-key
   VAPI_PHONE_NUMBER_ID=your-phone-id
   VAPI_SERVER_SECRET=your-webhook-secret
   
   # Twilio
   TWILIO_ACCOUNT_SID=your-account-sid
   TWILIO_AUTH_TOKEN=your-auth-token
   TWILIO_WHATSAPP_FROM=whatsapp:+1234567890
   
   # Application
   APP_URL=http://localhost:3000
   EXPRESS_BASE_URL=http://localhost:3001
   ```

4. **Set Up Database**
   ```bash
   # Run migrations in Supabase SQL Editor
   # Or use Supabase CLI:
   supabase db push
   ```

5. **Load Sample Properties**
   ```bash
   npm run load-properties
   ```

6. **Start Development Servers**
   ```bash
   # Terminal 1: Frontend (Next.js or Vite)
   npm run dev
   
   # Terminal 2: Express webhook server (if using)
   npm run webhook
   ```

### Running Locally

**Frontend:** `http://localhost:3000` (or 5173 for Vite)  
**API:** `http://localhost:3000/api/*` (Next.js) or `http://localhost:3001/api/*` (Express)

**Test Endpoints:**
```bash
# Health check
curl http://localhost:3001/health

# Test property search
curl -X POST http://localhost:3000/api/properties/search \
  -H "Content-Type: application/json" \
  -d '{"query": "3 bedroom house"}'
```

### Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key |
| `OPENAI_API_KEY` | ✅ | OpenAI API key for embeddings |
| `VAPI_API_KEY` | ✅ | VAPI API key |
| `VAPI_PHONE_NUMBER_ID` | ✅ | VAPI phone number ID |
| `VAPI_SERVER_SECRET` | ⚠️ | Webhook secret (recommended) |
| `TWILIO_ACCOUNT_SID` | ⚠️ | Twilio account SID (for WhatsApp) |
| `TWILIO_AUTH_TOKEN` | ⚠️ | Twilio auth token |
| `TWILIO_WHATSAPP_FROM` | ⚠️ | WhatsApp sender number |
| `APP_URL` | ⚠️ | Application base URL |
| `N8N_WEBHOOK_URL` | ❌ | n8n webhook URL (optional) |

---

## 7. Deployment Guide

### Vercel Deployment

1. **Connect Repository**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "Add New Project"
   - Import your GitHub repository

2. **Configure Build Settings**
   - Framework: Next.js (or Vite)
   - Build Command: `npm run build`
   - Output Directory: `.next` (Next.js) or `dist` (Vite)

3. **Add Environment Variables**
   - Go to Project Settings → Environment Variables
   - Add all production environment variables
   - Mark sensitive variables as "Encrypted"

4. **Deploy**
   - Click "Deploy"
   - Wait for build to complete
   - Test production URL

### Database Migrations

**Using Supabase Dashboard:**
1. Go to SQL Editor
2. Copy migration SQL
3. Run migration
4. Verify tables/indexes created

**Using Supabase CLI:**
```bash
supabase db push
```

### Environment Setup

See [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) for complete checklist.

### Testing Checklist

After deployment, run:

```bash
# E2E tests
npm run e2e-test

# RAG tests
npm run test-rag
```

**Manual Tests:**
- [ ] Submit lead form
- [ ] Receive AI call
- [ ] Test property search
- [ ] Book appointment
- [ ] Verify WhatsApp message
- [ ] Check dashboard analytics

---

## 8. Common Issues & Solutions

### API Rate Limits

**Issue:** OpenAI API rate limit exceeded

**Solution:**
- Implement exponential backoff
- Add rate limiting middleware
- Cache embeddings to avoid regeneration
- Use batch processing with delays

```typescript
// Rate limiting example
const RATE_LIMIT_DELAY_MS = 250
await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS))
```

**Issue:** Supabase connection limit

**Solution:**
- Use connection pooling
- Close connections properly
- Monitor connection count in Supabase dashboard

---

### Vector Search Too Slow

**Issue:** Property search takes > 2 seconds

**Solutions:**

1. **Rebuild Index**
   ```sql
   DROP INDEX properties_embedding_idx;
   CREATE INDEX properties_embedding_idx
     ON properties
     USING ivfflat (embedding vector_cosine_ops)
     WITH (lists = 100);
   ANALYZE properties;
   ```

2. **Adjust Index Lists**
   ```sql
   -- For ~1000 properties: lists = 10
   -- For ~10,000 properties: lists = 100
   -- For ~100,000 properties: lists = 1000
   ```

3. **Reduce Search Space**
   - Apply filters before vector search
   - Use similarity threshold to filter early
   - Limit results in SQL, not application

4. **Cache Frequent Queries**
   ```typescript
   const cacheKey = JSON.stringify(filters)
   const cached = cache.get(cacheKey)
   if (cached) return cached
   ```

---

### VAPI Call Failures

**Issue:** Calls not initiating

**Solutions:**
- ✅ Verify `VAPI_API_KEY` is correct
- ✅ Check phone number format: `+1234567890` (with country code)
- ✅ Ensure phone number is verified in VAPI dashboard
- ✅ Check VAPI account credits/limits
- ✅ Review VAPI logs for error messages

**Issue:** Function calls not working

**Solutions:**
- ✅ Verify webhook URL is publicly accessible
- ✅ Check `VAPI_SERVER_SECRET` matches
- ✅ Test webhook with VAPI webhook tester
- ✅ Review function names match exactly
- ✅ Check function parameters are valid JSON

**Issue:** AI not speaking naturally

**Solutions:**
- ✅ Update system prompt with examples
- ✅ Format function results for speech
- ✅ Use natural language in responses
- ✅ Test in VAPI playground first

---

### WhatsApp Message Errors

**Issue:** Messages not sending

**Solutions:**
- ✅ Verify Twilio credentials are correct
- ✅ Check phone number format: `whatsapp:+1234567890`
- ✅ Ensure WhatsApp is enabled for your Twilio number
- ✅ Verify Twilio account has credits
- ✅ Check Twilio logs for error codes

**Issue:** Images not displaying

**Solutions:**
- ✅ Use publicly accessible image URLs
- ✅ Ensure images are HTTPS
- ✅ Check image format (JPG, PNG supported)
- ✅ Verify image size < 5MB

**Issue:** Message formatting issues

**Solutions:**
- ✅ Use Twilio message format guidelines
- ✅ Test with Twilio API explorer
- ✅ Check special characters are escaped
- ✅ Verify message length < 1600 characters

---

### Database Issues

**Issue:** Embeddings not generating

**Solutions:**
- ✅ Check `OPENAI_API_KEY` is set
- ✅ Verify API key has credits
- ✅ Check OpenAI API status
- ✅ Review error logs for API errors
- ✅ Test embedding generation manually

**Issue:** Properties not found in search

**Solutions:**
- ✅ Verify properties have embeddings: `SELECT COUNT(*) FROM properties WHERE embedding IS NOT NULL;`
- ✅ Check similarity threshold isn't too high
- ✅ Ensure index is built: `ANALYZE properties;`
- ✅ Test with lower threshold (0.5) to see if results exist

**Issue:** Slow database queries

**Solutions:**
- ✅ Add indexes on frequently filtered columns
- ✅ Use `EXPLAIN ANALYZE` to identify slow queries
- ✅ Enable query performance monitoring in Supabase
- ✅ Consider connection pooling

---

### General Troubleshooting

**Check Logs:**
```bash
# Vercel logs
vercel logs

# Local server logs
# Check terminal output

# Supabase logs
# Check Supabase dashboard → Logs
```

**Test Endpoints:**
```bash
# Health check
curl http://localhost:3001/health

# Test property search
curl -X POST http://localhost:3000/api/properties/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test"}'
```

**Verify Environment Variables:**
```bash
# Check if variables are set
echo $OPENAI_API_KEY
echo $SUPABASE_URL
```

---

## Additional Resources

- **Supabase Docs:** https://supabase.com/docs
- **pgvector Docs:** https://github.com/pgvector/pgvector
- **OpenAI Embeddings:** https://platform.openai.com/docs/guides/embeddings
- **VAPI Docs:** https://docs.vapi.ai
- **Twilio WhatsApp:** https://www.twilio.com/docs/whatsapp

---

## Support

For issues or questions:
- **GitHub Issues:** https://github.com/yourusername/gnanova/issues
- **Email:** support@gnanova.com
- **Documentation:** This file

---

**Last Updated:** 2026-01-15  
**Version:** 1.0.0
