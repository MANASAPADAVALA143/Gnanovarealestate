# VAPI Webhook Setup Guide

## Local Development with ngrok

For local development, you need to expose your webhook endpoint to VAPI.

### Option 1: Use Vercel CLI (Recommended)

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Run local development:**
   ```bash
   vercel dev
   ```
   
   This will start both your Vite app and API routes on the same port.

3. **Expose with ngrok:**
   ```bash
   ngrok http 5173
   ```

4. **Add webhook in VAPI Dashboard:**
   - URL: `https://your-ngrok-url.ngrok.io/api/vapi-webhook`
   - Events: `call.ended`

### Option 2: Simple Express Server (Alternative)

If you prefer not to use Vercel CLI, you can create a simple Express server:

1. **Install dependencies:**
   ```bash
   npm install express cors
   npm install -D @types/express @types/cors tsx
   ```

2. **Create a simple server** (see `server/webhook-server.ts` - to be created)

3. **Run the server:**
   ```bash
   npx tsx server/webhook-server.ts
   ```

4. **Expose with ngrok:**
   ```bash
   ngrok http 3001
   ```

## Production (Vercel)

When deploying to Vercel, create `api/vapi-webhook.ts` as a serverless function:

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleVapiWebhook } from '../src/api/vapi-webhook'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const result = await handleVapiWebhook(req.body)
    return res.status(200).json(result)
  } catch (error: any) {
    console.error('Webhook error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
```

Then add the webhook in VAPI Dashboard:
- URL: `https://your-domain.vercel.app/api/vapi-webhook`
- Events: `call.ended`

## Installing ngrok

1. Download from: https://ngrok.com/download
2. Extract and add to PATH, or use via command line
3. (Optional) Sign up for a free account to get a persistent URL

## Testing

After setting up, make a test call from your dashboard. The webhook should receive the `call.ended` event and process it.







