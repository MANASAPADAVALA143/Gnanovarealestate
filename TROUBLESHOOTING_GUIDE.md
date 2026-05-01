# 🔧 Troubleshooting Guide

Based on your test results, here's what needs to be fixed:

---

## ❌ **CURRENT ERRORS**

### Error 1: "Supabase URL is not configured"
**Test:** `npm run test-rag`  
**Error:** `Error: Supabase URL is not configured. Please set SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL in your environment.`

**Fix:**
1. Create `.env.local` file in project root
2. Add:
   ```env
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   OPENAI_API_KEY=sk-proj-...
   ```
3. Restart terminal/IDE
4. Re-run: `npm run test-rag`

---

### Error 2: "VAPI_API_KEY not set"
**Test:** `npm run test-vapi-call`  
**Error:** `❌ VAPI_API_KEY not set!`

**Fix:**
1. Add to `.env.local`:
   ```env
   VAPI_API_KEY=your-vapi-key
   VAPI_PHONE_NUMBER_ID=your-phone-id
   ```
2. Get key from: https://dashboard.vapi.ai
3. Re-run: `npm run test-vapi-call +15551234567`

**Note:** This is optional - you can skip if not testing VAPI calls yet.

---

### Error 3: "fetch failed"
**Tests:** `npm run test-recommend`, `npm run test-whatsapp`  
**Error:** `fetch failed` or `ECONNREFUSED`

**Fix:**
1. **Start the dev server:**
   ```bash
   npm run dev
   ```
2. **Wait for server to start** (should show "Local: http://localhost:3000")
3. **In another terminal, run tests:**
   ```bash
   npm run test-recommend
   npm run test-whatsapp
   ```

**Check if server is running:**
```bash
npm run check-servers
```

---

## ✅ **STEP-BY-STEP FIX**

### Step 1: Create `.env.local` (2 minutes)

Create file `.env.local` in project root:

```env
# REQUIRED
OPENAI_API_KEY=sk-proj-your-key-here
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OPTIONAL (for VAPI calls)
VAPI_API_KEY=your-vapi-key
VAPI_PHONE_NUMBER_ID=your-phone-id

# OPTIONAL (for WhatsApp)
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_WHATSAPP_FROM=whatsapp:+1234567890
```

**Where to get:**
- **OpenAI:** https://platform.openai.com/api-keys
- **Supabase:** https://supabase.com/dashboard → Your Project → Settings → API
- **VAPI:** https://dashboard.vapi.ai → Settings → API Keys
- **Twilio:** https://console.twilio.com → Account Info

---

### Step 2: Start Development Server (1 minute)

```bash
# Terminal 1: Start Vite/Next.js
npm run dev

# Wait for: "Local: http://localhost:3000"
# Keep this terminal open!
```

**If using Express too:**
```bash
# Terminal 2: Start Express
npm run webhook

# Wait for: "Server running on port 3001"
```

---

### Step 3: Verify Servers Running (30 seconds)

```bash
# In a new terminal:
npm run check-servers
```

**Should show:**
```
✅ Vite/Next.js (port 3000) is running
✅ Express (port 3001) is running
✅ Property Search API is running
```

---

### Step 4: Run Database Migration (5 minutes)

1. Go to: https://supabase.com/dashboard
2. Select your project
3. Click "SQL Editor"
4. Click "New query"
5. Copy contents of `supabase/migrations/001_enable_pgvector.sql`
6. Paste and click "Run"
7. Repeat for `002_create_bookings.sql`

**Verify:**
- Go to Database → Tables
- Should see: `properties`, `leads`, `bookings`, `calls`

---

### Step 5: Load Properties (2 minutes)

```bash
# Make sure .env.local has Supabase credentials
npm run load-properties
```

**Expected output:**
```
✅ Loaded 50 properties
✅ All properties have embeddings
```

---

### Step 6: Re-run Tests (2 minutes)

```bash
# Full verification
npm run verify

# Individual tests
npm run test-rag              # Should work now
npm run test-recommend        # Should work if server running
npm run test-whatsapp         # Should work if server running
```

---

## 🎯 **QUICK DIAGNOSIS**

Run this to see what's wrong:

```bash
# Check environment variables
npm run verify

# Check if servers are running
npm run check-servers

# Check if properties are loaded
# (Go to Supabase Dashboard → Database → Tables → properties)
```

---

## 📋 **CHECKLIST**

Before running tests:

- [ ] `.env.local` file exists with required variables
- [ ] Dev server running (`npm run dev`)
- [ ] Express server running (`npm run webhook`) - if using
- [ ] Database migrations run
- [ ] Properties loaded (`npm run load-properties`)
- [ ] Verification script passes (`npm run verify`)

---

## 🚨 **COMMON MISTAKES**

### Mistake 1: Environment variables in wrong file
❌ **Wrong:** `.env` or `.env.example`  
✅ **Right:** `.env.local`

### Mistake 2: Server not running
❌ **Wrong:** Running tests without starting server  
✅ **Right:** Start server first, then run tests in another terminal

### Mistake 3: Wrong Supabase key
❌ **Wrong:** Using anon key for service operations  
✅ **Right:** Use service_role key for scripts

### Mistake 4: Not restarting after .env changes
❌ **Wrong:** Editing .env.local but not restarting  
✅ **Right:** Restart terminal/IDE after editing .env.local

---

## 💡 **QUICK FIXES**

### Fix 1: Test Scripts Can't Read .env.local
**Problem:** Scripts show "not configured" even though .env.local exists

**Solution:**
- Make sure file is named exactly `.env.local` (not `.env`)
- Check file is in project root (same level as package.json)
- Restart terminal after creating file
- Test scripts now auto-load .env.local (updated)

### Fix 2: Server Won't Start
**Problem:** Port already in use

**Solution:**
```bash
# Find what's using port 3000:
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue

# Kill the process or change port in vite.config.ts
```

### Fix 3: Properties Not Loading
**Problem:** `npm run load-properties` fails

**Solution:**
- Check Supabase credentials in .env.local
- Verify `properties` table exists (run migration)
- Check OpenAI API key is valid
- Check API credits/quota

---

## 🎯 **WHAT TO DO RIGHT NOW**

1. **Create `.env.local`** with Supabase and OpenAI credentials
2. **Start dev server:** `npm run dev` (keep running)
3. **Check servers:** `npm run check-servers` (in new terminal)
4. **Run migration** in Supabase Dashboard
5. **Load properties:** `npm run load-properties`
6. **Re-test:** `npm run test-rag`

**Once these are done, all tests should pass!** ✅

---

## 📞 **STILL STUCK?**

1. **Check verification report:**
   ```bash
   npm run verify
   ```

2. **Check server status:**
   ```bash
   npm run check-servers
   ```

3. **Check specific test:**
   - Look at error message
   - Check if it's environment, server, or database issue
   - Follow the specific fix above

4. **Review documentation:**
   - `QUICK_START_GUIDE.md`
   - `VERIFICATION_REPORT.md`
   - `DOCUMENTATION.md`
