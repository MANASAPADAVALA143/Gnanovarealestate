# Gnanova Real Estate — Environment Setup

## Overview
- 3 servers to run: Vite (3000), Webhook (3001), Next.js (3002)
- 1 database: Supabase
- 4 external services: Supabase, OpenAI, Twilio, VAPI

---

## 1. Supabase
Variables needed:
```env
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Where to get them:
- Go to supabase.com/dashboard → your project → 
  Settings → API
- URL = Project URL
- Anon key = public anon key
- Service role key = secret (keep private)

Migration step:
- Open SQL Editor in Supabase dashboard
- Run all files in supabase/migrations/ in order (001 to 020)

---

## 2. OpenAI
Variables needed:
```env
OPENAI_API_KEY
```

Where to get it:
- platform.openai.com → API Keys → Create new key

Used for:
- RAG property search (pgvector embeddings)
- AI listing writer
- Lead scoring

After adding key, run:
```bash
npm run load-properties
```
to generate property embeddings.

---

## 3. Twilio (WhatsApp)
Variables needed:
```env
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_WHATSAPP_FROM (e.g. whatsapp:+14155238886)
TWILIO_WEBHOOK_URL (your public URL + /webhook/whatsapp/inbound)
```

Where to get them:
- twilio.com/console → Account Info (SID + token)
- Messaging → Try it out → WhatsApp (sandbox number)

Webhook setup:
- Run ngrok:
```bash
ngrok http 3001
```
- Copy the https URL
- Set TWILIO_WEBHOOK_URL=https://xxxx.ngrok.io/webhook/whatsapp/inbound
- In Twilio console → WhatsApp sandbox settings → 
  paste URL in "When a message comes in" field

Test:
- Send "join <sandbox-word>" from your phone to the sandbox number
- Send any message → you should get auto-reply within seconds

---

## 4. VAPI (AI Voice Calls)
Variables needed:
```env
VAPI_API_KEY
VAPI_ASSISTANT_ID
VAPI_PHONE_NUMBER_ID
```

Where to get them:
- dashboard.vapi.ai → API Keys
- Create an assistant named "Sarah" 
- Buy or assign a phone number in VAPI dashboard

Used for:
- Outbound AI calls to new leads
- Inbound AI receptionist

---

## 5. Facebook Lead Ads (optional for pilot)
Variables needed:
```env
FACEBOOK_PAGE_ACCESS_TOKEN
FACEBOOK_VERIFY_TOKEN (any string you choose)
```

Where to get them:
- developers.facebook.com → your app → Webhooks
- Page Access Token from your Facebook Page settings

---

## env-template.txt reference
All variable names are listed in env-template.txt in the 
project root. Copy it to .env.local and fill in values.

## Minimum vars for Starter package demo
If you only want to demo the CRM, pipeline, tasks, 
and WhatsApp — you only need:
- Supabase (all 3 vars)
- Twilio (all 4 vars)
OpenAI and VAPI are only needed for RAG and AI voice calls.
