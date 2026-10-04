-- Run all of these in Supabase SQL editor

-- Migration logs (for Tranquil CRM import history)
CREATE TABLE IF NOT EXISTS migration_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  migration_date TIMESTAMP DEFAULT now(),
  total_records INTEGER,
  successful INTEGER,
  failed INTEGER,
  duplicates INTEGER,
  file_name TEXT,
  status TEXT CHECK (status IN ('In Progress', 'Completed', 'Failed')),
  error_log JSONB
);

-- Club Memberships
CREATE TABLE IF NOT EXISTS memberships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_name TEXT NOT NULL,
  member_phone TEXT NOT NULL,
  member_email TEXT,
  membership_tier TEXT CHECK (membership_tier IN ('Silver', 'Gold', 'Platinum')),
  membership_id TEXT UNIQUE,
  start_date DATE,
  expiry_date DATE,
  total_amount NUMERIC,
  amount_paid NUMERIC DEFAULT 0,
  payment_status TEXT DEFAULT 'Pending' CHECK (payment_status IN ('Pending', 'Partial', 'Paid')),
  whatsapp_sent BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Expired', 'Cancelled')),
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS membership_benefits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tier TEXT NOT NULL,
  benefit TEXT NOT NULL
);

INSERT INTO membership_benefits (tier, benefit) VALUES
('Silver', 'Access to co-working lounge'),
('Silver', 'Free WiFi'),
('Silver', '5 meeting room hours/month'),
('Gold', 'Dedicated desk'),
('Gold', '15 meeting room hours/month'),
('Gold', 'Guest passes x2/month'),
('Platinum', 'Private cabin access'),
('Platinum', 'Unlimited meeting rooms'),
('Platinum', 'Concierge support'),
('Platinum', '10 guest passes/month')
ON CONFLICT DO NOTHING;

-- WhatsApp Bot conversations
CREATE TABLE IF NOT EXISTS bot_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  name TEXT,
  current_step INTEGER DEFAULT 1,
  budget TEXT,
  interest_type TEXT,
  timeline TEXT,
  source TEXT,
  qualification_score TEXT CHECK (qualification_score IN ('Hot', 'Warm', 'Cold')),
  status TEXT DEFAULT 'In Progress' CHECK (status IN ('In Progress', 'Completed', 'Dropped')),
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

-- Enable RLS on all new tables (allow authenticated users)
ALTER TABLE migration_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_authenticated" ON migration_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_authenticated" ON memberships FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_authenticated_read" ON membership_benefits FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_authenticated" ON bot_conversations FOR ALL TO authenticated USING (true) WITH CHECK (true);
