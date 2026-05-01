# 🔄 Migrate Values from .env to .env.local

Based on your VS Code screenshot, I can see you have credentials in `.env` but need them in `.env.local` with the correct variable names.

---

## 📋 **Variable Mapping**

Your `.env` file uses `VITE_` prefixes (for client-side), but the scripts need server-side variable names.

### **Required Mapping:**

| In `.env` (Vite) | In `.env.local` (Scripts) | Status |
|------------------|---------------------------|--------|
| `VITE_SUPABASE_URL` | `SUPABASE_URL` | ⚠️ Need to copy |
| `SUPABASE_SERVICE_ROLE_KEY` | `SUPABASE_SERVICE_ROLE_KEY` | ✅ Already correct |
| `VITE_VAPI_API_KEY` | `VAPI_API_KEY` | ✅ Already in .env.local |
| `VITE_VAPI_PHONE_NUMBER` | `VAPI_PHONE_NUMBER_ID` | ⚠️ Need to add |
| (missing) | `OPENAI_API_KEY` | ❌ Need to add |

---

## ✅ **Step-by-Step Migration**

### Step 1: Open Both Files
1. Open `.env` (source)
2. Open `.env.local` (destination)

### Step 2: Copy Values to `.env.local`

Add these to your `.env.local` file:

```env
# ============================================
# REQUIRED: Supabase Database
# ============================================
# Copy from .env: VITE_SUPABASE_URL → SUPABASE_URL
SUPABASE_URL=https://mhdnoufdloigblgcypjl.supabase.co

# Copy from .env: SUPABASE_SERVICE_ROLE_KEY (already correct)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oZG5vdWZkbG9pZ2JsZ2N5cGpsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzQ5NzY3MywiZXhwIjoyMDUzMDczNjczfQ.xxxxx

# ============================================
# REQUIRED: OpenAI API (for embeddings)
# ============================================
# ⚠️ MISSING: You need to get this from https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-proj-YOUR_OPENAI_KEY_HERE

# ============================================
# OPTIONAL: VAPI Voice AI
# ============================================
# Already in .env.local
VAPI_API_KEY=c360e136-6f49-4c3b-b346-4125a57245f8

# Copy from .env: VITE_VAPI_PHONE_NUMBER → VAPI_PHONE_NUMBER_ID
VAPI_PHONE_NUMBER_ID=+15707084979

# ============================================
# OPTIONAL: Application URLs
# ============================================
APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 🎯 **Quick Copy-Paste Template**

Copy this into your `.env.local` and fill in the values:

```env
# REQUIRED - Copy from .env
SUPABASE_URL=https://mhdnoufdloigblgcypjl.supabase.co
SUPABASE_SERVICE_ROLE_KEY=PASTE_YOUR_SERVICE_ROLE_KEY_FROM_ENV

# REQUIRED - Get from OpenAI (NEW - you don't have this yet)
OPENAI_API_KEY=sk-proj-YOUR_OPENAI_KEY_HERE

# OPTIONAL - Already have VAPI_API_KEY, add phone number
VAPI_API_KEY=c360e136-6f49-4c3b-b346-4125a57245f8
VAPI_PHONE_NUMBER_ID=+15707084979

# OPTIONAL - Server config
APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## ⚠️ **Missing: OpenAI API Key**

You need to get an OpenAI API key:

1. Go to: https://platform.openai.com/api-keys
2. Click **"Create new secret key"**
3. Name it: "Gnanova Development"
4. Copy the key (starts with `sk-proj-` or `sk-`)
5. Paste into `.env.local` as `OPENAI_API_KEY`

**Cost:** Very cheap (~$0.0001 per 1K tokens for embeddings)

---

## ✅ **After Migration**

1. **Save `.env.local`**
2. **Restart terminal/IDE**
3. **Validate:**
   ```bash
   npm run validate-env
   ```

Should show:
```
✅ SUPABASE_URL: Configured
✅ SUPABASE_SERVICE_ROLE_KEY: Configured
✅ OPENAI_API_KEY: Configured
```

---

## 🔍 **Verify Your Setup**

Run this to check everything:
```bash
npm run validate-env
```

If all required variables are set, you'll see:
```
✅ All required variables are configured!
💡 You can now run: npm run verify
```

---

## 📝 **Summary**

**What you have:**
- ✅ Supabase URL (in `.env` as `VITE_SUPABASE_URL`)
- ✅ Supabase Service Role Key (in `.env`)
- ✅ VAPI API Key (already in `.env.local`)

**What you need to do:**
1. Copy `VITE_SUPABASE_URL` → `SUPABASE_URL` in `.env.local`
2. Copy `SUPABASE_SERVICE_ROLE_KEY` → `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`
3. Copy `VITE_VAPI_PHONE_NUMBER` → `VAPI_PHONE_NUMBER_ID` in `.env.local`
4. **Get OpenAI API key** and add as `OPENAI_API_KEY`

**Then you're ready to test!** 🚀
