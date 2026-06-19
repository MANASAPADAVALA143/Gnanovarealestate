-- Viewing Management: property viewings linked to leads/deals
-- Distinct from public.bookings (Appointments calendar) — pre-deal property visits
-- Depends on: public.leads, public.deals (019), public.properties, public.agents

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.viewing_status AS ENUM (
    'scheduled',
    'confirmed',
    'completed',
    'no_show',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.viewing_interest_level AS ENUM (
    'low',
    'medium',
    'high'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- viewings
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.viewings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status public.viewing_status NOT NULL DEFAULT 'scheduled',
  client_name TEXT,
  client_phone TEXT,
  feedback TEXT,
  interest_level public.viewing_interest_level,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT viewings_lead_or_client_chk CHECK (
    lead_id IS NOT NULL
    OR (client_name IS NOT NULL AND trim(client_name) <> '')
  )
);

CREATE INDEX IF NOT EXISTS idx_viewings_agent_id ON public.viewings(agent_id);
CREATE INDEX IF NOT EXISTS idx_viewings_scheduled_at ON public.viewings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_viewings_status ON public.viewings(status);
CREATE INDEX IF NOT EXISTS idx_viewings_lead_id ON public.viewings(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_viewings_property_id ON public.viewings(property_id);
CREATE INDEX IF NOT EXISTS idx_viewings_deal_id ON public.viewings(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_viewings_agent_scheduled ON public.viewings(agent_id, scheduled_at);

COMMENT ON TABLE public.viewings IS 'Property viewings (pre-deal visits); separate from bookings/Appointments';
COMMENT ON COLUMN public.viewings.deal_id IS 'Optional link when viewing is tied to an active deal at viewing stage';
COMMENT ON COLUMN public.viewings.scheduled_at IS 'Single timestamptz for calendar scheduling (vs bookings date+time split)';

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.viewings_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_viewings_set_updated_at ON public.viewings;
CREATE TRIGGER trg_viewings_set_updated_at
  BEFORE UPDATE ON public.viewings
  FOR EACH ROW
  EXECUTE FUNCTION public.viewings_set_updated_at();

-- Log to lead_activities when a viewing is marked completed (matches recordLeadActivity pattern)
CREATE OR REPLACE FUNCTION public.viewings_log_completed_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_content TEXT;
  v_property_label TEXT;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.status <> 'completed' OR OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT left(
    coalesce(
      nullif(trim(p.address), ''),
      nullif(trim(p.city), ''),
      'property'
    ),
    120
  )
  INTO v_property_label
  FROM public.properties p
  WHERE p.id = NEW.property_id;

  v_content := 'Viewing completed'
    || coalesce(' at ' || v_property_label, '')
    || coalesce(' — interest: ' || NEW.interest_level::text, '')
    || coalesce(
      ' — ' || left(trim(NEW.feedback), 500),
      ''
    );

  INSERT INTO public.lead_activities (lead_id, type, content, created_by, created_at)
  VALUES (
    NEW.lead_id,
    'viewing',
    left(v_content, 2000),
    NEW.agent_id,
    NOW()
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_viewings_log_completed_activity ON public.viewings;
CREATE TRIGGER trg_viewings_log_completed_activity
  AFTER UPDATE OF status, feedback, interest_level ON public.viewings
  FOR EACH ROW
  EXECUTE FUNCTION public.viewings_log_completed_activity();

-- ---------------------------------------------------------------------------
-- RLS (reuses is_deal_manager from 019 — brokerage-wide manager check)
-- ---------------------------------------------------------------------------

ALTER TABLE public.viewings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS viewings_agent_select ON public.viewings;
CREATE POLICY viewings_agent_select ON public.viewings
  FOR SELECT TO authenticated
  USING (
    agent_id = auth.uid()
    OR public.is_deal_manager()
  );

DROP POLICY IF EXISTS viewings_agent_insert ON public.viewings;
CREATE POLICY viewings_agent_insert ON public.viewings
  FOR INSERT TO authenticated
  WITH CHECK (
    agent_id = auth.uid()
    OR public.is_deal_manager()
  );

DROP POLICY IF EXISTS viewings_agent_update ON public.viewings;
CREATE POLICY viewings_agent_update ON public.viewings
  FOR UPDATE TO authenticated
  USING (
    agent_id = auth.uid()
    OR public.is_deal_manager()
  )
  WITH CHECK (
    agent_id = auth.uid()
    OR public.is_deal_manager()
  );

DROP POLICY IF EXISTS viewings_agent_delete ON public.viewings;
CREATE POLICY viewings_agent_delete ON public.viewings
  FOR DELETE TO authenticated
  USING (
    agent_id = auth.uid()
    OR public.is_deal_manager()
  );
