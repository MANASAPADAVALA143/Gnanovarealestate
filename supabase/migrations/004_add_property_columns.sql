-- Add missing columns to properties table for CSV upload feature

ALTER TABLE properties ADD COLUMN IF NOT EXISTS agent_id uuid;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS country text DEFAULT 'USA';

-- Create index for agent_id
CREATE INDEX IF NOT EXISTS idx_properties_agent_id ON properties(agent_id);

-- Add created_at if not exists
ALTER TABLE properties ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
