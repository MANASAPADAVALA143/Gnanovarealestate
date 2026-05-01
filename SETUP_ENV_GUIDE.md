# 🔐 Environment Variables Setup Guide

This guide will help you get all your API keys and credentials set up.

---

## ⚡ **QUICK START (5 Minutes)**

### Step 1: Copy Template
```bash
# The .env.local file is already created with placeholders
# Just open it and replace REPLACE_ME with your actual values
```

### Step 2: Get Required Credentials

#### ✅ **1. Supabase (REQUIRED)**
1. Go to: https://supabase.com/dashboard
2. Select your project (or create one)
3. Click **Settings** → **API**
4. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ (NOT anon key!)

**Example:**
```env
SUPABASE_URL=https://abcdefghijklmnop.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjE2MjM5MDIyfQ.xxxxx
```

#### ✅ **2. OpenAI (REQUIRED)**
1. Go to: https://platform.openai.com/api-keys
2. Click **Create new secret key**
3. Name it: "Gnanova Development"
4. Copy the key (starts with `sk-proj-` or `sk-`)

**Example:**
```env
OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz1234567890
```

**Cost:** ~$0.0001 per 1K tokens (very cheap for embeddings)

---

## 🎯 **OPTIONAL CREDENTIALS**

### ⚠️ **3. VAPI (Optional - for AI voice calls)**
**Only needed if testing AI phone calls**

1. Go to: https://dashboard.vapi.ai
2. Sign up / Log in
3. Go to **Settings** → **API Keys**
4. Copy:
   - **API Key** → `VAPI_API_KEY`
   - **Phone Number ID** → `VAPI_PHONE_NUMBER_ID`
   - **Server Secret** → `VAPI_SERVER_SECRET`

**Example:**
```env
VAPI_API_KEY=c360e136-6f49-4c3b-b346-4125a57245f8
VAPI_PHONE_NUMBER_ID=12345678-1234-1234-1234-123456789012
VAPI_SERVER_SECRET=your-server-secret-here
```

**Note:** You can skip this if not testing voice calls yet.

---

### ⚠️ **4. Twilio (Optional - for WhatsApp)**
**Only needed if testing WhatsApp messaging**

1. Go to: https://console.twilio.com
2. Sign up / Log in
3. Go to **Account** → **Account Info**
4. Copy:
   - **Account SID** → `TWILIO_ACCOUNT_SID`
   - **Auth Token** → `TWILIO_AUTH_TOKEN`
5. Get WhatsApp number from **Messaging** → **Try it out** → **Send a WhatsApp message**

**Example:**
```env
TWILIO_ACCOUNT_SID=AC1234567890abcdef1234567890abcdef
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

**Note:** You can skip this if not testing WhatsApp yet.

---

## 📝 **FILLING OUT .env.local**

1. **Open `.env.local`** in your project root
2. **Find each section** (marked with `# =====`)
3. **Replace `REPLACE_ME`** with your actual values
4. **Save the file**
5. **Restart your terminal/IDE**

**Minimum required:**
- ✅ `SUPABASE_URL`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`
- ✅ `OPENAI_API_KEY`

**Everything else is optional!**

---

## ✅ **VERIFY SETUP**

After filling in your credentials:

```bash
# Check if everything is configured
npm run verify

# Should show:
# ✅ Environment variables: 3/3 required variables set
```

---

## 🔒 **SECURITY NOTES**

1. **Never commit `.env.local` to Git**
   - It's already in `.gitignore`
   - Contains sensitive API keys

2. **Use Service Role Key, not Anon Key**
   - Service role key has full database access
   - Anon key is for client-side (limited access)

3. **Rotate keys if exposed**
   - If you accidentally commit keys, rotate them immediately
   - Generate new keys from each service's dashboard

4. **Use different keys for production**
   - Don't use development keys in production
   - Set production keys in Vercel/your hosting platform

---

## 🚨 **TROUBLESHOOTING**

### Error: "Supabase URL is not configured"
- ✅ Check `.env.local` exists in project root
- ✅ Check `SUPABASE_URL` starts with `https://`
- ✅ Restart terminal after editing `.env.local`

### Error: "OpenAI API key invalid"
- ✅ Check key starts with `sk-proj-` or `sk-`
- ✅ Check no extra spaces or quotes
- ✅ Verify key is active in OpenAI dashboard

### Error: "Service role key invalid"
- ✅ Make sure you copied the **service_role** key, not anon key
- ✅ Check key is complete (very long string)
- ✅ No extra spaces or line breaks

### Scripts still can't read .env.local
- ✅ Make sure file is named exactly `.env.local` (not `.env`)
- ✅ Check file is in project root (same folder as `package.json`)
- ✅ Restart terminal/IDE completely
- ✅ Test scripts now auto-load .env.local (updated)

---

## 📋 **CHECKLIST**

Before running tests:

- [ ] `.env.local` file created
- [ ] `SUPABASE_URL` filled in
- [ ] `SUPABASE_SERVICE_ROLE_KEY` filled in
- [ ] `OPENAI_API_KEY` filled in
- [ ] (Optional) VAPI credentials if testing calls
- [ ] (Optional) Twilio credentials if testing WhatsApp
- [ ] File saved
- [ ] Terminal/IDE restarted
- [ ] Verified with `npm run verify`

---

## 🎯 **NEXT STEPS**

After setting up `.env.local`:

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Run database migration:**
   - Go to Supabase Dashboard → SQL Editor
   - Run migration files

3. **Load properties:**
   ```bash
   npm run load-properties
   ```

4. **Test everything:**
   ```bash
   npm run verify
   npm run test-rag
   ```

**You're ready to go!** 🚀
