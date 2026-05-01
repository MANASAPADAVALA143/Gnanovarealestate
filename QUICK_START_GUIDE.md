# 🚀 Gnanova Quick Start Guide

## Current Status: 3/6 Tests Passing

**✅ Working:** Dependencies, Files, API Endpoints  
**❌ Needs Setup:** Environment Variables, Database, VAPI Config Verification

---

## ⚡ **5-MINUTE SETUP**

### Step 1: Create `.env.local` (2 minutes)

Create a file named `.env.local` in your project root with:

```env
# REQUIRED - Get these from your accounts
OPENAI_API_KEY=sk-proj-your-key-here
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OPTIONAL - For full functionality
VAPI_API_KEY=your-vapi-key
VAPI_PHONE_NUMBER_ID=your-phone-id
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_WHATSAPP_FROM=whatsapp:+1234567890
```

**Where to get:**
- **OpenAI:** https://platform.openai.com/api-keys → Create new key
- **Supabase:** https://supabase.com/dashboard → Your project → Settings → API
  - URL: Project URL
  - Service Role Key: service_role key (⚠️ keep secret!)

---

### Step 2: Run Database Migration (2 minutes)

**Option A: Supabase Dashboard (Easiest)**
1. Go to: https://supabase.com/dashboard
2. Select your project
3. Click "SQL Editor" in left sidebar
4. Click "New query"
5. Copy contents of `supabase/migrations/001_enable_pgvector.sql`
6. Paste and click "Run"
7. Repeat for `002_create_bookings.sql`

**Option B: Supabase CLI**
```bash
# If you have Supabase CLI installed:
supabase db push
```

**Verify:**
- Go to Database → Tables
- Should see: `properties`, `leads`, `bookings`, `calls`

---

### Step 3: Load Sample Properties (1 minute)

```bash
npm run load-properties
```

**Expected output:**
```
✅ Loaded 50 properties
✅ All properties have embeddings
```

**If errors:**
- Check environment variables are set
- Check Supabase connection
- Verify `properties` table exists

---

## ✅ **VERIFY EVERYTHING WORKS**

### Run Full Verification:
```bash
npx tsx scripts/verify-all.ts
```

**Should show:** `6/6 tests passed` ✅

### Test Property Search:
```bash
curl -X POST http://localhost:3000/api/properties/search \
  -H "Content-Type: application/json" \
  -d '{"query":"3 bedroom house under 500K","maxPrice":500000,"minBeds":3}'
```

**Expected:** JSON with properties array

---

## 🧪 **TEST INDIVIDUAL FEATURES**

### Test 1: RAG Property Search
```bash
npm run test-rag
```

### Test 2: Property Recommendations
```bash
# First create a lead, then:
npm run test-recommend
```

### Test 3: Live AI Call
```bash
# Make sure Express server is running:
npm run webhook

# In another terminal:
npm run test-vapi-call +15551234567
```

### Test 4: WhatsApp
```bash
npm run test-whatsapp "property-uuid" "+15551234567"
```

---

## 🐛 **COMMON ISSUES & FIXES**

### Issue 1: "OPENAI_API_KEY not set"
**Fix:** Add to `.env.local` and restart dev server

### Issue 2: "Properties table does not exist"
**Fix:** Run migration SQL in Supabase Dashboard

### Issue 3: "No properties found"
**Fix:** Run `npm run load-properties`

### Issue 4: "Embedding dimension mismatch"
**Fix:** 
```sql
-- In Supabase SQL Editor:
ALTER TABLE properties DROP COLUMN embedding;
ALTER TABLE properties ADD COLUMN embedding vector(1536);
```

### Issue 5: "Connection refused" on API calls
**Fix:** 
- Start dev server: `npm run dev`
- Start Express: `npm run webhook` (if using)

---

## 📋 **CHECKLIST**

Before testing live features:

- [ ] `.env.local` created with all required variables
- [ ] Database migrations run (pgvector enabled, tables created)
- [ ] Properties loaded (50+ with embeddings)
- [ ] Dev server running (`npm run dev`)
- [ ] Express server running (`npm run webhook`) - if using
- [ ] Verification script shows 6/6 tests passed

---

## 🎯 **WHAT'S NEXT**

Once all tests pass:

1. **Test RAG Search** - Verify semantic property search works
2. **Test VAPI Calls** - Make a real AI call to your phone
3. **Test Recommendations** - Generate property recommendations
4. **Test WhatsApp** - Send property via WhatsApp (if Twilio configured)
5. **Deploy to Production** - Follow `DEPLOYMENT_CHECKLIST.md`

---

## 📞 **NEED HELP?**

**Check these files:**
- `VERIFICATION_REPORT.md` - Detailed status
- `DOCUMENTATION.md` - Full API documentation
- `DEPLOYMENT_CHECKLIST.md` - Production deployment guide
- `TEST_RESULTS.md` - Individual test results

**Run verification anytime:**
```bash
npx tsx scripts/verify-all.ts
```

---

**You're almost there!** 🚀 Just need to set environment variables and load data.
