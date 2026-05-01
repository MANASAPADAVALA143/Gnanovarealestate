# Setup Verification Status

## ✅ Completed

### Test 1: Dependencies
- ✅ `openai` package installed (v6.19.0)
- ✅ `@supabase/supabase-js` package installed (v2.89.0)

### Test 5: Required Files
- ✅ `lib/embeddings.ts` exists
- ✅ `scripts/load-properties.ts` exists
- ✅ `scripts/test-rag.ts` exists
- ✅ `app/api/properties/search/route.ts` exists
- ✅ `types/property.ts` exists

## ⚠️ Needs Configuration

### Test 2: Environment Variables
You need to set these in `.env.local`:

```env
# Required
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional (for full functionality)
VAPI_API_KEY=your-vapi-key
VAPI_PHONE_NUMBER_ID=your-phone-id
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_WHATSAPP_FROM=whatsapp:+1234567890
```

**To check if variables are set:**
```bash
# PowerShell
Get-Content .env.local | Select-String -Pattern "OPENAI_API_KEY|SUPABASE"
```

### Test 3: Supabase Connection
- ⚠️ Cannot test until `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
- After setting, run: `npm run verify-setup` to test connection

### Test 4: OpenAI API Key
- ⚠️ Cannot test until `OPENAI_API_KEY` is set
- Get your key from: https://platform.openai.com/api-keys

### Test 6: VAPI Configuration
- ✅ `ragEnabledAssistant` function exists in `src/lib/vapi-config.ts` (line 273)
- Note: The function is present in the codebase

## 📋 Next Steps

### 1. Set Up Environment Variables
Create or update `.env.local` with your credentials:

```bash
# Copy from .env.example if it exists, or create new
cp .env.example .env.local  # or create manually
```

### 2. Run Database Migrations
```bash
# Option A: Using Supabase CLI
supabase db push

# Option B: Manual (Supabase Dashboard → SQL Editor)
# Copy and run: supabase/migrations/001_enable_pgvector.sql
# Then: supabase/migrations/002_create_bookings.sql
```

### 3. Load Sample Properties
```bash
npm run load-properties
```

### 4. Test Property Search
```bash
# Start dev server
npm run dev

# In another terminal, test the API
curl -X POST http://localhost:3000/api/properties/search \
  -H "Content-Type: application/json" \
  -d '{"query":"3 bedroom house under 500K","maxPrice":500000,"minBeds":3}'
```

### 5. Run Full Verification
```bash
npm run verify-setup
```

## 🔧 Quick Test Commands

```bash
# Test 1: Check dependencies
npm list openai @supabase/supabase-js

# Test 2: Check environment variables (PowerShell)
Get-Content .env.local | Select-String -Pattern "OPENAI|SUPABASE"

# Test 3: Run migration (if Supabase CLI installed)
supabase db push

# Test 4: Load properties
npm run load-properties

# Test 5: Test property search (after starting dev server)
curl -X POST http://localhost:3000/api/properties/search \
  -H "Content-Type: application/json" \
  -d '{"query":"3 bedroom house"}'

# Test 6: Check VAPI config
Get-Content src/lib/vapi-config.ts | Select-String "ragEnabledAssistant"
```

## 📝 Notes

- The `langchain` and `@langchain/openai` packages are **not required** - the code uses the `openai` package directly
- The `ragEnabledAssistant` function is in `src/lib/vapi-config.ts` (not `lib/vapi-config.ts`)
- Environment variables can be prefixed with `VITE_` or `NEXT_PUBLIC_` depending on your setup
