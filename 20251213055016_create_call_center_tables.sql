/*
  # Voice Call Center Schema

  1. New Tables
    - `leads`
      - `id` (uuid, primary key)
      - `name` (text)
      - `email` (text)
      - `phone` (text)
      - `location` (text)
      - `budget` (text)
      - `property_type` (text)
      - `status` (text) - lead status
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `calls`
      - `id` (uuid, primary key)
      - `lead_id` (uuid, foreign key to leads)
      - `status` (text) - active, ringing, completed, failed, no_answer
      - `outcome` (text) - scheduled, not_interested, callback, no_answer, null
      - `duration` (integer) - call duration in seconds
      - `transcript` (text) - AI transcription
      - `recording_url` (text) - URL to call recording
      - `started_at` (timestamptz)
      - `ended_at` (timestamptz)
      - `created_at` (timestamptz)
    
    - `call_settings`
      - `id` (uuid, primary key)
      - `user_id` (uuid) - for multi-user support
      - `vapi_api_key` (text)
      - `phone_number` (text)
      - `ai_assistant_id` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
*/

-- Create leads table
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text NOT NULL,
  location text,
  budget text,
  property_type text,
  status text DEFAULT 'new',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create calls table
CREATE TABLE IF NOT EXISTS calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  status text DEFAULT 'queued',
  outcome text,
  duration integer DEFAULT 0,
  transcript text,
  recording_url text,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create call_settings table
CREATE TABLE IF NOT EXISTS call_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  vapi_api_key text,
  phone_number text,
  ai_assistant_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for leads
CREATE POLICY "Anyone can view leads"
  ON leads FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can insert leads"
  ON leads FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update leads"
  ON leads FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete leads"
  ON leads FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for calls
CREATE POLICY "Anyone can view calls"
  ON calls FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can insert calls"
  ON calls FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update calls"
  ON calls FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete calls"
  ON calls FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for call_settings
CREATE POLICY "Users can view own settings"
  ON call_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON call_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON call_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_calls_lead_id ON calls(lead_id);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);

-- Insert sample data for demonstration
INSERT INTO leads (name, email, phone, location, budget, property_type, status) VALUES
  ('John Mitchell', 'john.mitchell@email.com', '+1-555-0101', 'Los Angeles, CA', '$800k-1.2M', 'Single Family Home', 'hot'),
  ('Sarah Anderson', 'sarah.anderson@email.com', '+1-555-0102', 'San Francisco, CA', '$1.5M-2M', 'Condo', 'warm'),
  ('Michael Chen', 'michael.chen@email.com', '+1-555-0103', 'Seattle, WA', '$600k-900k', 'Townhouse', 'new'),
  ('Emily Rodriguez', 'emily.rodriguez@email.com', '+1-555-0104', 'Austin, TX', '$400k-600k', 'Single Family Home', 'hot'),
  ('David Thompson', 'david.thompson@email.com', '+1-555-0105', 'Denver, CO', '$700k-1M', 'Single Family Home', 'warm')
ON CONFLICT DO NOTHING;
