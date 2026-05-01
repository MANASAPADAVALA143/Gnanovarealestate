-- Portal webhooks (Zillow / Realtor.com): audit log + lead attribution

CREATE TABLE IF NOT EXISTS public.portal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal TEXT NOT NULL,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  duplicate BOOLEAN NOT NULL DEFAULT FALSE,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_portal_events_portal_received
  ON public.portal_events (portal, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_portal_events_lead
  ON public.portal_events (lead_id)
  WHERE lead_id IS NOT NULL;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS portal_source TEXT,
  ADD COLUMN IF NOT EXISTS portal_lead_id TEXT,
  ADD COLUMN IF NOT EXISTS speed_to_lead_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS first_call_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS message TEXT,
  ADD COLUMN IF NOT EXISTS property_address TEXT;

COMMENT ON COLUMN public.leads.portal_source IS 'zillow | realtor (and similar portal keys)';
COMMENT ON COLUMN public.leads.portal_lead_id IS 'External portal lead id for deduplication';

CREATE UNIQUE INDEX IF NOT EXISTS leads_portal_unique
  ON public.leads (portal_source, portal_lead_id)
  WHERE portal_lead_id IS NOT NULL;
