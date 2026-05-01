# 🔧 Fix "Row-Level Security Policy" Signup Error

## ❌ The Error You're Seeing:
```
new row violates row-level security policy for table "agents"
```

This happens because Supabase is blocking new agent signups due to missing RLS (Row Level Security) policies.

---

## ✅ How to Fix It (2 Minutes):

### **Step 1: Open Supabase Dashboard**
1. Go to: https://supabase.com/dashboard
2. Login to your account
3. Select your **Gnanova** project

### **Step 2: Go to SQL Editor**
1. Click **"SQL Editor"** in the left sidebar
2. Click **"New Query"**

### **Step 3: Copy & Paste This SQL**
Copy the entire SQL below and paste it into the editor:

```sql
-- Fix Agents Table RLS for Signup
-- This allows users to create their own agent record during signup

-- Enable RLS on agents table
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (cleanup)
DROP POLICY IF EXISTS "Users can view own agent" ON agents;
DROP POLICY IF EXISTS "Users can insert own agent" ON agents;
DROP POLICY IF EXISTS "Users can update own agent" ON agents;
DROP POLICY IF EXISTS "Agents can view their own data" ON agents;
DROP POLICY IF EXISTS "Agents can insert their own data" ON agents;
DROP POLICY IF EXISTS "Agents can update their own data" ON agents;

-- Policy 1: Users can view their own agent record
CREATE POLICY "Users can view own agent"
  ON agents FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Policy 2: Users can insert their own agent record during signup
-- THIS IS THE KEY POLICY THAT FIXES THE SIGNUP ERROR!
CREATE POLICY "Users can insert own agent"
  ON agents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Policy 3: Users can update their own agent record
CREATE POLICY "Users can update own agent"
  ON agents FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
```

### **Step 4: Run the SQL**
1. Click **"Run"** button (or press `Ctrl + Enter`)
2. Wait for success message: ✅ **"Success. No rows returned"**

### **Step 5: Test Signup Again**
1. Go back to: http://localhost:3000/signup
2. Fill in your details:
   - Full Name: MANASA padavala
   - Email: manusmile0587@gmail.com
   - Phone: +918886469888
   - Location: India
   - Password: (your password)
3. Click **"Create Account"**
4. ✅ **Should work now!**

---

## 🎯 What This Does:

The SQL creates 3 security policies for the `agents` table:

1. **SELECT Policy** - Agents can view their own data
2. **INSERT Policy** ⭐ - Agents can create their own account (fixes signup!)
3. **UPDATE Policy** - Agents can update their own data

**Security:** Each agent can ONLY access their own data, not other agents' data.

---

## ✅ Verification:

After running the SQL, you should be able to:
- ✅ Sign up as a new agent
- ✅ Login with your credentials
- ✅ Access the dashboard
- ✅ See only your own leads and properties

---

## 🚨 Still Getting Errors?

If you still see errors, check:

1. **Did the SQL run successfully?**
   - Look for green "Success" message in Supabase SQL Editor

2. **Is the agents table created?**
   - Go to Supabase → Table Editor
   - Look for `agents` table
   - It should have columns: id, email, full_name, phone, location

3. **Are you using the correct email?**
   - Email must not already exist in the system
   - Try a different email if needed

---

## 💡 Alternative: Quick Test Account

If you want to skip signup and test immediately, I can help you create a test account directly in Supabase.

Just let me know and I'll provide the SQL to insert a test agent account!

---

## 📚 What is RLS (Row Level Security)?

**RLS** is a Supabase security feature that controls who can access which rows in a table.

**Without RLS policies:**
- Nobody can read/write data (blocked by default)
- You get errors like "row violates security policy"

**With RLS policies:**
- Users can only access their own data
- Agents can't see other agents' leads
- Secure multi-tenant application! 🔒

---

## 🎉 Next Steps After Signup Works:

Once you successfully sign up:
1. ✅ Login to dashboard
2. ✅ Go to Properties page
3. ✅ Upload sample-properties-full.csv
4. ✅ Generate embeddings
5. ✅ Test RAG search!

---

**Ready to fix it? Go run the SQL in Supabase now!** 🚀
