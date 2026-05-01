-- Outbound campaign + lead scoring (Prompt #1)
-- Safe on fresh DBs and on projects that already applied 003_add_integrations_and_campaigns.sql
-- (those already define outbound_campaigns / campaign_leads with a wider column set).

-- 0. `leads` base table — required before ALTER / FKs. This repo had no earlier migration that
--    CREATEs public.leads; if you only ran fragments in the SQL editor you get 42P01 otherwise.
CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  location text,
  status text NOT NULL DEFAULT 'new',
  source text DEFAULT 'website',
  timeline text,
  ghl_contact_id text,
  agent_id uuid,
  property_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 1. Add scoring columns to existing leads table
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS score_label TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS call_transcript TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sentiment TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_outbound_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS outbound_attempt_count INTEGER DEFAULT 0;

-- 2. Campaigns table
CREATE TABLE IF NOT EXISTS public.outbound_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT DEFAULT 'draft', -- draft | running | paused | completed
  total_leads INTEGER DEFAULT 0,
  calls_made INTEGER DEFAULT 0,
  calls_connected INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- 3. Campaign leads junction table
CREATE TABLE IF NOT EXISTS public.campaign_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.outbound_campaigns(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending', -- pending | calling | completed | failed | no-answer
  vapi_call_id TEXT,
  called_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  lead_score INTEGER,
  score_label TEXT,
  transcript TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3b. Older schemas (from 003) already have these tables without VAPI/scoring columns — add them.
ALTER TABLE public.outbound_campaigns
  ADD COLUMN IF NOT EXISTS total_leads INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS calls_connected INTEGER DEFAULT 0;

ALTER TABLE public.campaign_leads
  ADD COLUMN IF NOT EXISTS vapi_call_id TEXT,
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS lead_score INTEGER,
  ADD COLUMN IF NOT EXISTS score_label TEXT,
  ADD COLUMN IF NOT EXISTS transcript TEXT;

-- 4. Index for fast score filtering
CREATE INDEX IF NOT EXISTS idx_leads_score ON public.leads(lead_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign ON public.campaign_leads(campaign_id);
