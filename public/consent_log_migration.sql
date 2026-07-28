-- Run this in your Supabase SQL editor
-- supabase/migrations/20260629_create_consent_log.sql

CREATE TABLE IF NOT EXISTS consent_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID,
  email         TEXT,
  phone         TEXT,
  context       TEXT NOT NULL CHECK (context IN ('lead', 'demo', 'openhouse')),
  consented_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address    TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consent_log_lead_id ON consent_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_consent_log_email   ON consent_log(email);

ALTER TABLE consent_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view consent logs"
  ON consent_log FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow insert"
  ON consent_log FOR INSERT
  WITH CHECK (true);

-- Add consent columns to existing tables
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS consent_given     BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS consent_timestamp TIMESTAMPTZ;

ALTER TABLE demo_requests
  ADD COLUMN IF NOT EXISTS consent_given     BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS consent_timestamp TIMESTAMPTZ;

COMMENT ON TABLE consent_log IS 'UAE PDPL audit log — never delete rows.';
