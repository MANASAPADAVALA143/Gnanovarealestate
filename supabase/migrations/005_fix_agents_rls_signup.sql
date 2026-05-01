-- ===================================
-- Fix Agents Table RLS for Signup
-- ===================================
-- This migration fixes the "new row violates row-level security policy" error
-- by allowing users to create their own agent record during signup.

-- Enable RLS on agents table (if not already enabled)
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own agent" ON agents;
DROP POLICY IF EXISTS "Users can insert own agent" ON agents;
DROP POLICY IF EXISTS "Users can update own agent" ON agents;
DROP POLICY IF EXISTS "Agents can view their own data" ON agents;
DROP POLICY IF EXISTS "Agents can insert their own data" ON agents;
DROP POLICY IF EXISTS "Agents can update their own data" ON agents;

-- ===================================
-- NEW RLS POLICIES
-- ===================================

-- Policy 1: Users can view their own agent record
CREATE POLICY "Users can view own agent"
  ON agents FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Policy 2: Users can insert their own agent record during signup
-- This is the CRITICAL policy that allows signup to work!
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

-- ===================================
-- VERIFICATION
-- ===================================
-- After running this migration, test by:
-- 1. Creating a new agent account via signup form
-- 2. Checking that no RLS errors appear
-- 3. Verifying the agent can access their dashboard

-- To verify policies are active, run:
-- SELECT * FROM pg_policies WHERE tablename = 'agents';
