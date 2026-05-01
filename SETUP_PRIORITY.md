# 🎯 Setup Priority Guide

Since you'll add the OpenAI API key later, here's what you can do **now** vs **later**.

---

## ✅ **What You Can Do NOW (Without OpenAI Key)**

### 1. **Set Up Database** ✅
```bash
# Run Supabase migrations
# Go to: Supabase Dashboard → SQL Editor
# Run: supabase/migrations/001_enable_pgvector.sql
# Run: supabase/migrations/002_create_bookings.sql
```

### 2. **Test Supabase Connection** ✅
```bash
# Verify Supabase credentials work
npm run verify
# Should show: ✅ Supabase connection: OK
```

### 3. **Start Development Servers** ✅
```bash
# Terminal 1: Frontend
npm run dev

# Terminal 2: Express (if using)
npm run webhook
```

### 4. **Test Basic API Endpoints** ✅
```bash
# Health check
curl http://localhost:3001/health

# Check if servers are running
npm run check-servers
```

### 5. **Set Up Other Credentials** ✅
- ✅ VAPI (already have)
- ✅ Anthropic (already have)
- ⚠️ Twilio (optional, can add later)

---

## ⏳ **What Needs OpenAI Key (Add Later)**

### 1. **Generate Property Embeddings** ❌
```bash
# This will fail without OpenAI key
npm run load-properties
# Error: OPENAI_API_KEY is not set
```

### 2. **RAG Property Search** ❌
```bash
# This will fail without OpenAI key
npm run test-rag
# Error: OPENAI_API_KEY is not set
```

### 3. **Property Recommendations** ❌
```bash
# This will fail without OpenAI key
npm run test-recommend
# Error: OPENAI_API_KEY is not set
```

---

## 📋 **Recommended Setup Order**

### **Phase 1: Now (Without OpenAI)**
1. ✅ Add Supabase credentials to `.env.local`
2. ✅ Run database migrations
3. ✅ Test Supabase connection
4. ✅ Start dev servers
5. ✅ Test basic endpoints

### **Phase 2: Later (With OpenAI)**
1. ⏳ Get OpenAI API key
2. ⏳ Add to `.env.local`
3. ⏳ Run `npm run load-properties`
4. ⏳ Test RAG search: `npm run test-rag`
5. ⏳ Test full system: `npm run verify`

---

## 🔍 **Current Status Check**

Run this to see what's configured:

```bash
npm run validate-env
```

**Expected output (without OpenAI):**
```
✅ SUPABASE_URL: Configured
✅ SUPABASE_SERVICE_ROLE_KEY: Configured
⚠️  OPENAI_API_KEY: Not set (can add later)

⚠️  OpenAI API key not set (can add later)
✅ Supabase is configured - you can test database setup!
```

---

## 💡 **What to Do Right Now**

1. **Add Supabase credentials to `.env.local`:**
   ```env
   SUPABASE_URL=https://mhdnoufdloigblgcypjl.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

2. **Test Supabase connection:**
   ```bash
   npm run verify
   ```

3. **Run database migrations:**
   - Go to Supabase Dashboard → SQL Editor
   - Run migration files

4. **Start dev server:**
   ```bash
   npm run dev
   ```

5. **Add OpenAI key later when ready:**
   - Get from: https://platform.openai.com/api-keys
   - Add to `.env.local`: `OPENAI_API_KEY=sk-proj-...`
   - Then run: `npm run load-properties`

---

## 📝 **Quick Reference**

| Task | Needs OpenAI? | Can Do Now? |
|------|---------------|-------------|
| Database setup | ❌ No | ✅ Yes |
| Supabase connection | ❌ No | ✅ Yes |
| Start servers | ❌ No | ✅ Yes |
| Basic API tests | ❌ No | ✅ Yes |
| Load properties | ✅ Yes | ❌ No |
| RAG search | ✅ Yes | ❌ No |
| Property recommendations | ✅ Yes | ❌ No |

---

**You're good to go with database setup!** Add OpenAI key when you're ready to test the RAG system. 🚀
