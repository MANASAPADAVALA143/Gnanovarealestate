# Test 7: VAPI Function Handler Test

## Issue Found

The VAPI function handler endpoint (`/api/vapi/functions`) is located in `app/api/vapi/functions/route.ts`, which suggests it's a **Next.js API route**.

However, your project uses:
- **Vite** frontend on port 3000
- **Express** backend on port 3001 (webhook-server.js)
- Vite proxies `/api` requests to Express on port 3001

## The Problem

The VAPI functions endpoint tries to call:
```typescript
const response = await fetch(`${baseUrl}/api/properties/search`, ...)
```

But the property search endpoint might be:
1. In Next.js (if you're using Next.js) - would be at `app/api/properties/search/route.ts`
2. In Express (webhook-server.js) - would need to be added there
3. Not implemented yet

## Solutions

### Option 1: If using Next.js
Make sure Next.js dev server is running on port 3000, and the VAPI endpoint will work.

### Option 2: If using Express only
You need to either:
1. Move the VAPI functions endpoint to Express (`webhook-server.js`)
2. Or add the property search endpoint to Express

### Option 3: Test with Express directly
If the property search is in Express, test the VAPI endpoint by pointing it to Express:

```typescript
// In app/api/vapi/functions/route.ts, change:
const baseUrl = 'http://localhost:3001' // Express server
```

## Current Test Results

❌ **Endpoint returns 500 error**

This is likely because:
1. The property search API (`/api/properties/search`) is not available
2. Environment variables are missing (OPENAI_API_KEY, SUPABASE_URL)
3. Properties are not loaded in the database

## Next Steps

1. **Check if property search endpoint exists:**
   ```bash
   # Test Express server
   curl http://localhost:3001/api/properties/search
   
   # Test Vite proxy
   curl http://localhost:3000/api/properties/search
   ```

2. **If property search doesn't exist, add it to Express:**
   - Add route in `webhook-server.js`
   - Or ensure Next.js is running

3. **Load properties:**
   ```bash
   npm run load-properties
   ```

4. **Set environment variables:**
   - `OPENAI_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

5. **Re-test:**
   ```bash
   npx tsx scripts/test-vapi-functions.ts
   ```

## Expected Response

When working correctly, the endpoint should return:

```json
{
  "result": "I found 3 properties that match your search. The best match is a 3-bedroom, 2-bath home at 123 Main St, Miami, FL listed for $450,000. It is a single family, garage home. I also found 2 other options that match your criteria. Would you like me to share more details or hear about the other properties?"
}
```

This is natural language that VAPI can speak to the caller.
