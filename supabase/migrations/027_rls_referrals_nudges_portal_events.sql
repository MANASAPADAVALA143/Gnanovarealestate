-- APPROVED 2026-07-23 — shared claim pool (option A) for nurture/SLA routing.
-- Apply in Supabase SQL editor (same as 016/026).
--
-- Self-contained: creates lead_referrals / lead_nudges / portal_events if missing
-- (017 / 008 may not have been applied on this project), then enables RLS.
--
-- Pattern: access follows parent lead ownership + NULL shared pool + is_deal_manager().
-- Writes today:
--   portal_events  → service_role (server/lib/portal-intake.ts)
--   lead_nudges    → service_role (server/lib/nudge-scheduler.ts)
--   lead_referrals → service_role / future UI
--
-- service_role bypasses RLS automatically.

-- ---------------------------------------------------------------------------
-- 0. Tables (idempotent — safe if 017/008 already ran)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 1. lead_referrals (via leads.agent_id)
-- ---------------------------------------------------------------------------
ALTER TABLE public.lead_referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_referrals_agent_select ON public.lead_referrals;
DROP POLICY IF EXISTS lead_referrals_agent_insert ON public.lead_referrals;
DROP POLICY IF EXISTS lead_referrals_agent_update ON public.lead_referrals;
DROP POLICY IF EXISTS lead_referrals_agent_delete ON public.lead_referrals;

CREATE POLICY lead_referrals_agent_select ON public.lead_referrals
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_referrals.lead_id
        AND (
          l.agent_id = auth.uid()
          OR l.agent_id IS NULL
          OR public.is_deal_manager()
        )
    )
  );

CREATE POLICY lead_referrals_agent_insert ON public.lead_referrals
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_referrals.lead_id
        AND (
          l.agent_id = auth.uid()
          OR l.agent_id IS NULL
          OR public.is_deal_manager()
        )
    )
  );

CREATE POLICY lead_referrals_agent_update ON public.lead_referrals
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_referrals.lead_id
        AND (
          l.agent_id = auth.uid()
          OR l.agent_id IS NULL
          OR public.is_deal_manager()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_referrals.lead_id
        AND (
          l.agent_id = auth.uid()
          OR l.agent_id IS NULL
          OR public.is_deal_manager()
        )
    )
  );

CREATE POLICY lead_referrals_agent_delete ON public.lead_referrals
  FOR DELETE TO authenticated
  USING (
    public.is_deal_manager()
    OR EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_referrals.lead_id
        AND l.agent_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 2. lead_nudges (via leads.agent_id)
-- ---------------------------------------------------------------------------
ALTER TABLE public.lead_nudges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_nudges_agent_select ON public.lead_nudges;
DROP POLICY IF EXISTS lead_nudges_agent_insert ON public.lead_nudges;
DROP POLICY IF EXISTS lead_nudges_manager_delete ON public.lead_nudges;

CREATE POLICY lead_nudges_agent_select ON public.lead_nudges
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_nudges.lead_id
        AND (
          l.agent_id = auth.uid()
          OR l.agent_id IS NULL
          OR public.is_deal_manager()
        )
    )
  );

CREATE POLICY lead_nudges_agent_insert ON public.lead_nudges
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_nudges.lead_id
        AND (
          l.agent_id = auth.uid()
          OR l.agent_id IS NULL
          OR public.is_deal_manager()
        )
    )
  );

CREATE POLICY lead_nudges_manager_delete ON public.lead_nudges
  FOR DELETE TO authenticated
  USING (public.is_deal_manager());

-- ---------------------------------------------------------------------------
-- 3. portal_events (via leads.agent_id; raw_payload is sensitive)
-- ---------------------------------------------------------------------------
ALTER TABLE public.portal_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS portal_events_agent_select ON public.portal_events;
DROP POLICY IF EXISTS portal_events_manager_delete ON public.portal_events;

-- No INSERT/UPDATE for authenticated — webhook path is service_role only.
CREATE POLICY portal_events_agent_select ON public.portal_events
  FOR SELECT TO authenticated
  USING (
    public.is_deal_manager()
    OR (
      lead_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = portal_events.lead_id
          AND (
            l.agent_id = auth.uid()
            OR l.agent_id IS NULL
          )
      )
    )
  );

CREATE POLICY portal_events_manager_delete ON public.portal_events
  FOR DELETE TO authenticated
  USING (public.is_deal_manager());

-- Refresh PostgREST schema cache so new tables are visible immediately
NOTIFY pgrst, 'reload schema';
