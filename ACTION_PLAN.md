# 🎯 Action Plan - Fix Test Failures

Based on your test results, here's exactly what to do:

---

## 🔴 **CRITICAL ISSUES (Must Fix)**

### Issue 1: Environment Variables Not Set ❌
**Affects:** All tests

**Error Messages:**
- `Supabase URL is not configured`
- `VAPI_API_KEY not set`

**Fix (5 minutes):**

1. **Create `.env.local` file** in project root (same folder as `package.json`)

2. **Add these REQUIRED variables:**
   ```env
   OPENAI_API_KEY=sk-proj-your-actual-key-here
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

3. **Get credentials:**
   - **OpenAI:** https://platform.openai.com/api-keys → Create new key
   - **Supabase:** https://supabase.com/dashboard → Your Project → Settings → API
     - Copy "Project URL" → `SUPABASE_URL`
     - Copy "service_role" key → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ (NOT anon key!)

4. **Save file and restart terminal/IDE**

---

### Issue 2: Development Server Not Running ❌
**Affects:** Test 9, Test 10

**Error Messages:**
- `fetch failed`
- `ECONNREFUSED`

**Fix (1 minute):**

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Wait for:** `Local: http://localhost:3000`

3. **Keep terminal open!** (Don't close it)

4. **In a NEW terminal, run tests:**
   ```bash
   npm run test-recommend
   npm run test-whatsapp
   ```

**Verify server is running:**
```bash
npm run check-servers
```

---

## 🟡 **OPTIONAL (Can Fix Later)**

### Issue 3: VAPI Not Configured ⚠️
**Affects:** Test 8 (Live AI Call)

**Error:** `VAPI_API_KEY not set!`

**Fix (if you want to test AI calls):**
1. Add to `.env.local`:
   ```env
   VAPI_API_KEY=your-vapi-key
   VAPI_PHONE_NUMBER_ID=your-phone-id
   ```
2. Get from: https://dashboard.vapi.ai

**Note:** You can skip this if not testing AI calls yet.

---

### Issue 4: Twilio Not Configured ⚠️
**Affects:** Test 10 (WhatsApp)

**Error:** `TWILIO_ACCOUNT_SID missing`

**Fix (if you want to test WhatsApp):**
1. Add to `.env.local`:
   ```env
   TWILIO_ACCOUNT_SID=ACxxxxx
   TWILIO_AUTH_TOKEN=your-auth-token
   TWILIO_WHATSAPP_FROM=whatsapp:+1234567890
   ```

**Note:** You can skip this if not testing WhatsApp yet.

---

## ✅ **STEP-BY-STEP FIX (10 Minutes Total)**

### Step 1: Create `.env.local` (3 min)
```bash
# Create file in project root
# Add the 3 required variables (see above)
```

### Step 2: Start Dev Server (1 min)
```bash
# Terminal 1:
npm run dev

# Wait for server to start
# Keep this terminal open!
```

### Step 3: Verify Setup (1 min)
```bash
# Terminal 2 (new terminal):
npm run verify
npm run check-servers
```

### Step 4: Run Database Migration (3 min)
- Go to Supabase Dashboard → SQL Editor
- Run migration SQL files

### Step 5: Load Properties (2 min)
```bash
npm run load-properties
```

### Step 6: Test Again (1 min)
```bash
npm run test-rag
npm run test-recommend
```

---

## 📊 **CURRENT STATUS**

| Test | Status | Issue | Fix |
|------|--------|-------|-----|
| test-rag | ❌ | No Supabase URL | Add to .env.local |
| test-vapi-call | ❌ | No VAPI key | Add to .env.local (optional) |
| test-recommend | ❌ | Server not running | Run `npm run dev` |
| test-whatsapp | ❌ | Server not running | Run `npm run dev` |

---

## 🚀 **QUICK START**

**Minimum to get tests working:**

1. **Create `.env.local`:**
   ```env
   OPENAI_API_KEY=sk-...
   SUPABASE_URL=https://...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```

2. **Start server:**
   ```bash
   npm run dev
   ```

3. **Run tests (in new terminal):**
   ```bash
   npm run test-rag
   ```

**That's it!** Once environment variables are set and server is running, tests will work.

---

## 🔍 **VERIFY FIXES**

After fixing, run:

```bash
# Check everything
npm run verify

# Should show: 6/6 tests passed ✅
```

---

## 📝 **TEST RESULTS SUMMARY**

**Before Fix:**
- ❌ test-rag: Environment variables missing
- ❌ test-vapi-call: VAPI key missing (optional)
- ❌ test-recommend: Server not running
- ❌ test-whatsapp: Server not running

**After Fix:**
- ✅ test-rag: Should work (needs .env.local)
- ⚠️ test-vapi-call: Optional (needs VAPI key)
- ✅ test-recommend: Should work (needs server running)
- ✅ test-whatsapp: Should work (needs server running)

---

## 💡 **PRO TIPS**

1. **Keep dev server running** - Don't close the terminal running `npm run dev`
2. **Use multiple terminals** - One for server, one for tests
3. **Check .env.local location** - Must be in project root (same as package.json)
4. **Restart after .env changes** - Close and reopen terminal after editing .env.local
5. **Use check-servers** - Run `npm run check-servers` to verify servers before testing

---

**You're almost there!** Just need to:
1. ✅ Add environment variables
2. ✅ Start dev server
3. ✅ Run tests

Then everything will work! 🎉
