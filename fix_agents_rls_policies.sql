/*
  # Fix Agents Table RLS Policies
  
  This migration adds Row Level Security policies for the agents table
  to allow users to:
  1. Insert their own agent record during signup
  2. Select their own agent record
  3. Update their own agent record
*/

-- Enable RLS on agents table (if not already enabled)
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own agent" ON agents;
DROP POLICY IF EXISTS "Users can insert own agent" ON agents;
DROP POLICY IF EXISTS "Users can update own agent" ON agents;

-- RLS Policy: Users can view their own agent record
CREATE POLICY "Users can view own agent"
  ON agents FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- RLS Policy: Users can insert their own agent record (during signup)
CREATE POLICY "Users can insert own agent"
  ON agents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- RLS Policy: Users can update their own agent record
CREATE POLICY "Users can update own agent"
  ON agents FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);






