# 🔧 Quick Fix: Add SUPABASE_URL

## What's Missing

Your `.env.local` needs:
```env
SUPABASE_URL=https://mhdnoufdloigblgcypjl.supabase.co
```

## How to Fix

1. **Open `.env.local`** in your editor

2. **Add this line** (copy from your `.env` file):
   ```env
   SUPABASE_URL=https://mhdnoufdloigblgcypjl.supabase.co
   ```

3. **Save the file**

4. **Run validation:**
   ```bash
   npm run validate-env
   ```

## Expected Result

After adding `SUPABASE_URL`, you should see:
```
✅ SUPABASE_URL: Configured
✅ SUPABASE_SERVICE_ROLE_KEY: Configured
⚠️  OPENAI_API_KEY: Not set (can add later)
```

Then you can proceed with database setup! 🚀
