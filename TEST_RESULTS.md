# Test Results Summary

## Test 8: Live AI Call (IMPORTANT!)

### Status: ⚠️ Ready to Test (Requires Setup)

**Test Script:** `scripts/test-live-ai-call.ts`

**Prerequisites:**
- ✅ VAPI_API_KEY set in environment
- ✅ Express server running (`npm run webhook`)
- ✅ Valid phone number in E.164 format

**How to Run:**
```bash
# Make sure Express server is running first
npm run webhook

# In another terminal, run the test
npm run test-vapi-call +15551234567

# Or directly:
npx tsx scripts/test-live-ai-call.ts +15551234567
```

**What It Does:**
1. Calls `/api/vapi/initiate-call` endpoint (Express server)
2. Initiates a real VAPI call to the provided phone number
3. AI assistant "Sarah" will call and qualify the lead
4. During the call, you can test property search by saying: "Show me 3 bedroom homes under 500K"

**Expected Response:**
```json
{
  "success": true,
  "callId": "call-uuid-here",
  "message": "Call initiated successfully"
}
```

**Troubleshooting:**
- ❌ **401 Unauthorized:** Check VAPI_API_KEY
- ❌ **400 Bad Request:** Check phone number format (must start with +)
- ❌ **Connection refused:** Make sure Express server is running on port 3001

---

## Test 9: Property Recommendations

### Status: ❌ Failed (500 Error)

**Test Script:** `scripts/test-property-recommend.ts`

**Issue:** Endpoint returns 500 error

**Possible Causes:**
1. Server not running (Next.js or Express)
2. Environment variables not set (OPENAI_API_KEY, SUPABASE_URL)
3. Lead ID doesn't exist in database
4. Properties not loaded

**How to Fix:**

1. **Create a real lead first:**
   ```bash
   # Use the lead creation endpoint
   curl -X POST http://localhost:3001/api/leads/create \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Test Lead",
       "email": "test@example.com",
       "phone": "+1234567890",
       "location": "Miami, FL"
     }'
   ```
   Copy the `leadId` from the response.

2. **Load properties:**
   ```bash
   npm run load-properties
   ```

3. **Set environment variables:**
   - `OPENAI_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

4. **Re-test with real lead ID:**
   ```bash
   # Edit the script to use the real leadId, or:
   npx tsx scripts/test-property-recommend.ts
   ```

**Expected Response:**
```json
{
  "success": true,
  "properties": [
    {
      "id": "uuid",
      "address": "123 Main St",
      "city": "Miami",
      "price": 450000,
      "bedrooms": 3,
      "similarity_score": 0.87
    }
  ],
  "summary": "I found 5 great properties matching your criteria..."
}
```

---

## Test 10: WhatsApp Property Sending

### Status: ⚠️ Ready to Test (Requires Twilio Setup)

**Test Script:** `scripts/test-whatsapp.ts`

**Prerequisites:**
- ✅ TWILIO_ACCOUNT_SID set in environment
- ✅ TWILIO_AUTH_TOKEN set in environment
- ✅ TWILIO_WHATSAPP_FROM set (format: `whatsapp:+1234567890`)
- ✅ Valid property IDs in database
- ✅ WhatsApp-enabled phone number for testing

**How to Run:**
```bash
# Basic test (uses default test property ID)
npm run test-whatsapp

# With specific property IDs
npx tsx scripts/test-whatsapp.ts "uuid-1,uuid-2"

# With property IDs and phone number
npx tsx scripts/test-whatsapp.ts "uuid-1" "+15551234567"
```

**What It Does:**
1. Calls `/api/whatsapp/send-property` endpoint
2. Fetches property details from database
3. Formats message with property details
4. Sends WhatsApp message via Twilio
5. Logs message to database

**Expected Response:**
```json
{
  "success": true,
  "messageSid": "SM1234567890abcdef",
  "message": "WhatsApp message sent successfully",
  "properties": [/* property details */]
}
```

**Troubleshooting:**
- ❌ **400 Bad Request:** Check phone format (E.164: +1234567890), propertyIds array
- ❌ **401/403:** Check Twilio credentials
- ❌ **500 Error:** Check if properties exist in database, Twilio configuration
- ⚠️ **Twilio not configured:** Endpoint will validate input but won't send message

**Note:** The endpoint will validate the request even if Twilio is not configured, which is useful for testing the API structure.

---

## Quick Test Commands

```bash
# Test 8: Live AI Call (requires phone number)
npm run test-vapi-call +15551234567

# Test 9: Property Recommendations
npm run test-recommend

# Test 10: WhatsApp Property Sending
npm run test-whatsapp "property-uuid" "+15551234567"

# Or use curl directly:
curl -X POST http://localhost:3000/api/whatsapp/send-property \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+1234567890",
    "propertyIds": ["property-uuid-here"],
    "leadName": "Test User"
  }'
```

---

## Next Steps

1. ✅ **Test scripts created** - Both test scripts are ready
2. ⚠️ **Set up environment** - Configure API keys and database
3. ⚠️ **Load data** - Run `npm run load-properties`
4. ⚠️ **Start servers** - Run Express and/or Next.js dev server
5. ⚠️ **Run tests** - Execute both test scripts

---

## Architecture Notes

Your project has a mixed architecture:
- **Vite** frontend on port 3000 (proxies `/api` → Express on 3001)
- **Express** backend on port 3001 (`webhook-server.js`)
- **Next.js** API routes in `app/api/` (may not be accessible via Vite proxy)

**For Property Recommendations:**
- If endpoint is in Next.js (`app/api/properties/recommend/route.ts`), you need Next.js running
- If endpoint is in Express, it should be accessible via Vite proxy on port 3000

**For VAPI Calls:**
- Endpoint is in Express (`/api/vapi/initiate-call`)
- Accessible via Vite proxy or directly on port 3001
