-- Lead type, urgency, nudge tracking + referral + nudge audit
-- Note: 011 is already used in this repo (011_campaign_launch_filters.sql).

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lead_type TEXT DEFAULT 'buyer',
  ADD COLUMN IF NOT EXISTS urgency TEXT DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS nudge_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS nudge_count INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.lead_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  referred_to TEXT NOT NULL,
  referred_at TIMESTAMPTZ DEFAULT NOW(),
  referral_fee NUMERIC(10, 2),
  status TEXT DEFAULT 'sent',
  notes TEXT
);

CREATE TABLE IF NOT EXISTS public.lead_nudges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  message TEXT,
  status TEXT DEFAULT 'sent'
);

CREATE INDEX IF NOT EXISTS idx_lead_nudges_lead ON public.lead_nudges(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_referrals_lead ON public.lead_referrals(lead_id);
CREATE INDEX IF NOT EXISTS idx_leads_nudge_pending ON public.leads(created_at) WHERE nudge_count = 0;
