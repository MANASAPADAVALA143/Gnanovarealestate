# Complete Test Suite Summary

## ✅ Test Scripts Created

All test scripts have been created and are ready to use:

1. **Test 1-7:** E2E Test Suite (`scripts/e2e-test.ts`)
2. **Test 7:** VAPI Function Handler (`scripts/test-vapi-functions.ts`)
3. **Test 8:** Live AI Call (`scripts/test-live-ai-call.ts`)
4. **Test 9:** Property Recommendations (`scripts/test-property-recommend.ts`)
5. **Test 10:** WhatsApp Property Sending (`scripts/test-whatsapp.ts`)

## 📋 Test Status

### ✅ Ready to Run (Once Prerequisites Met)

| Test | Script | Prerequisites | Status |
|------|--------|---------------|--------|
| Test 8: Live AI Call | `test-live-ai-call.ts` | VAPI_API_KEY, Express server running | ⚠️ Ready |
| Test 9: Property Recommendations | `test-property-recommend.ts` | Properties loaded, valid leadId | ⚠️ Ready |
| Test 10: WhatsApp | `test-whatsapp.ts` | Twilio configured, valid propertyIds | ⚠️ Ready |

### ⚠️ Needs Setup

| Test | Issue | Solution |
|------|-------|----------|
| Test 7: VAPI Functions | 500 error | Property search API not accessible |
| Test 9: Recommendations | 500 error | Server not running or properties not loaded |
| Test 10: WhatsApp | 500 error | Server not running or Twilio not configured |

## 🚀 Quick Start Guide

### 1. Set Up Environment Variables

Create `.env.local` with:
```env
# Required
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# For VAPI (Test 8)
VAPI_API_KEY=your-vapi-key
VAPI_PHONE_NUMBER_ID=your-phone-id

# For WhatsApp (Test 10)
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_WHATSAPP_FROM=whatsapp:+1234567890
```

### 2. Start Servers

```bash
# Terminal 1: Express server (for VAPI calls, WhatsApp)
npm run webhook

# Terminal 2: Next.js/Vite dev server (for API routes)
npm run dev
# OR if using Next.js:
npx next dev
```

### 3. Load Sample Data

```bash
# Load properties into database
npm run load-properties
```

### 4. Run Tests

```bash
# Test 8: Live AI Call
npm run test-vapi-call +15551234567

# Test 9: Property Recommendations (after creating a lead)
npm run test-recommend

# Test 10: WhatsApp
npm run test-whatsapp "property-uuid" "+15551234567"

# Full E2E test suite
npm run e2e-test
```

## 📝 Test Details

### Test 8: Live AI Call

**Endpoint:** `POST /api/vapi/initiate-call` (Express)

**What it tests:**
- VAPI call initiation
- Real phone call to your number
- AI assistant conversation
- Property search during call (if configured)

**Usage:**
```bash
npm run test-vapi-call +15551234567
```

**Expected:** You receive a phone call from AI assistant "Sarah"

---

### Test 9: Property Recommendations

**Endpoint:** `POST /api/properties/recommend` (Next.js)

**What it tests:**
- RAG-based property recommendations
- Preference matching
- Summary generation

**Usage:**
```bash
# First, create a lead and get the leadId
curl -X POST http://localhost:3001/api/leads/create \
  -H "Content-Type: application/json" \
  -d '{"name": "Test", "phone": "+1234567890", "email": "test@example.com"}'

# Then run the test (update leadId in script)
npm run test-recommend
```

**Expected:** Returns 5 recommended properties with summary

---

### Test 10: WhatsApp Property Sending

**Endpoint:** `POST /api/whatsapp/send-property` (Next.js)

**What it tests:**
- Property fetching from database
- WhatsApp message formatting
- Twilio integration
- Message logging

**Usage:**
```bash
# Get property IDs from database first
npm run test-whatsapp "property-uuid-1,property-uuid-2" "+15551234567"
```

**Expected:** WhatsApp message sent to your phone with property details

---

## 🔧 Troubleshooting

### Common Issues

1. **500 Internal Server Error**
   - Check if server is running
   - Verify environment variables are set
   - Check database connection
   - Review server logs

2. **Connection Refused**
   - Ensure server is running on correct port
   - Check if port is already in use
   - Verify proxy configuration (Vite → Express)

3. **401/403 Unauthorized**
   - Check API keys are correct
   - Verify credentials in environment
   - Check API key permissions

4. **400 Bad Request**
   - Validate request payload format
   - Check required fields are present
   - Verify data types match expected format

### Architecture Notes

Your project uses:
- **Vite** on port 3000 (proxies `/api` → Express on 3001)
- **Express** on port 3001 (`webhook-server.js`)
- **Next.js** API routes in `app/api/` (may need Next.js dev server)

**For Next.js routes:**
- If using Next.js, run `npx next dev`
- Routes are accessible directly on port 3000 (or Next.js default port)

**For Express routes:**
- Accessible via Vite proxy: `http://localhost:3000/api/...`
- Or directly: `http://localhost:3001/api/...`

---

## 📊 Test Coverage

| Feature | Test | Status |
|---------|------|--------|
| Lead Creation | E2E Test 1 | ✅ |
| VAPI Call Initiation | E2E Test 2, Test 8 | ⚠️ |
| Property Search (RAG) | E2E Test 3, Test 7 | ⚠️ |
| Property Recommendations | E2E Test 4, Test 9 | ⚠️ |
| WhatsApp Messaging | E2E Test 5, Test 10 | ⚠️ |
| Booking Creation | E2E Test 6 | ✅ |
| Dashboard Analytics | E2E Test 7 | ✅ |

---

## 🎯 Next Steps

1. ✅ **Test scripts created** - All scripts are ready
2. ⚠️ **Environment setup** - Configure API keys and credentials
3. ⚠️ **Database setup** - Run migrations and load properties
4. ⚠️ **Server startup** - Start Express and/or Next.js servers
5. ⚠️ **Run tests** - Execute test scripts and verify results

---

## 📚 Additional Resources

- **Documentation:** See `DOCUMENTATION.md` for API reference
- **Deployment:** See `DEPLOYMENT_CHECKLIST.md` for production setup
- **Setup Status:** See `SETUP_STATUS.md` for current configuration status
