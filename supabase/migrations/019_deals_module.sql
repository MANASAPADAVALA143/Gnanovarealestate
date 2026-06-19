-- Deal Closure module: deals pipeline, commission fields, activity timeline
-- Depends on: public.leads, public.agents (migration 018_crm_layer.sql)

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.deal_stage AS ENUM (
    'viewing',
    'offer',
    'booking',
    'mou_signed',
    'spa_signed',
    'closed_won',
    'closed_lost'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.deal_activity_type AS ENUM (
    'stage_change',
    'note',
    'amount_update',
    'document',
    'system'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Optional manager flag for RLS (additive; defaults false)
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS is_manager BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------------------
-- deals
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  client_name TEXT,
  stage public.deal_stage NOT NULL DEFAULT 'viewing',
  unit_number TEXT,
  project_name TEXT,
  booking_amount NUMERIC(14, 2),
  token_amount NUMERIC(14, 2),
  sale_value NUMERIC(14, 2),
  commission_percent NUMERIC(5, 2),
  agent_commission NUMERIC(14, 2),
  brokerage_commission NUMERIC(14, 2),
  developer_incentive NUMERIC(14, 2),
  lost_reason TEXT,
  expected_close_date DATE,
  actual_close_date DATE,
  stage_entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT deals_client_or_lead_chk CHECK (
    lead_id IS NOT NULL OR (client_name IS NOT NULL AND trim(client_name) <> '')
  ),
  CONSTRAINT deals_lost_reason_chk CHECK (
    stage <> 'closed_lost' OR (lost_reason IS NOT NULL AND trim(lost_reason) <> '')
  )
);

CREATE INDEX IF NOT EXISTS idx_deals_agent_id ON public.deals(agent_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON public.deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_lead_id ON public.deals(lead_id);
CREATE INDEX IF NOT EXISTS idx_deals_agent_stage ON public.deals(agent_id, stage);
CREATE INDEX IF NOT EXISTS idx_deals_actual_close_date ON public.deals(actual_close_date)
  WHERE stage = 'closed_won';
CREATE INDEX IF NOT EXISTS idx_deals_created_at ON public.deals(created_at DESC);

-- ---------------------------------------------------------------------------
-- deal_activities (mirrors lead_activities pattern)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.deal_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  activity_type public.deal_activity_type NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.agents(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_deal_activities_deal
  ON public.deal_activities(deal_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Helpers & triggers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.deals_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deals_set_updated_at ON public.deals;
CREATE TRIGGER trg_deals_set_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.deals_set_updated_at();

-- Reset stage_entered_at when stage changes
CREATE OR REPLACE FUNCTION public.deals_on_stage_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.stage IS DISTINCT FROM OLD.stage THEN
    NEW.stage_entered_at := NOW();

    INSERT INTO public.deal_activities (deal_id, activity_type, description, created_by)
    VALUES (
      NEW.id,
      'stage_change',
      'Stage changed from ' || OLD.stage::text || ' to ' || NEW.stage::text,
      auth.uid()
    );

    IF NEW.stage = 'closed_won' AND NEW.actual_close_date IS NULL THEN
      NEW.actual_close_date := CURRENT_DATE;
    END IF;

    IF NEW.stage <> 'closed_lost' THEN
      NEW.lost_reason := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deals_on_stage_change ON public.deals;
CREATE TRIGGER trg_deals_on_stage_change
  BEFORE UPDATE OF stage ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.deals_on_stage_change();

-- Auto-calculate agent_commission when sale_value + commission_percent provided.
-- Trigger fires ONLY on INSERT or UPDATE OF sale_value, commission_percent, agent_commission
-- (editing unit_number etc. does not fire this). Manual override is preserved when an agent
-- sets agent_commission alone; recalc runs when sale_value or commission_percent changes.
CREATE OR REPLACE FUNCTION public.deals_calc_agent_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  inputs_changed BOOLEAN;
  manual_edit_only BOOLEAN;
BEGIN
  IF NEW.sale_value IS NULL OR NEW.commission_percent IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.agent_commission IS NULL THEN
      NEW.agent_commission := round(
        (NEW.sale_value * NEW.commission_percent / 100.0)::numeric,
        2
      );
    END IF;
    RETURN NEW;
  END IF;

  inputs_changed :=
    NEW.sale_value IS DISTINCT FROM OLD.sale_value
    OR NEW.commission_percent IS DISTINCT FROM OLD.commission_percent;

  manual_edit_only :=
    NEW.agent_commission IS DISTINCT FROM OLD.agent_commission
    AND NOT inputs_changed;

  IF manual_edit_only THEN
    RETURN NEW;
  END IF;

  IF NEW.agent_commission IS NULL OR inputs_changed THEN
    NEW.agent_commission := round(
      (NEW.sale_value * NEW.commission_percent / 100.0)::numeric,
      2
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deals_calc_agent_commission ON public.deals;
CREATE TRIGGER trg_deals_calc_agent_commission
  BEFORE INSERT OR UPDATE OF sale_value, commission_percent, agent_commission ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.deals_calc_agent_commission();

-- Log deal creation
CREATE OR REPLACE FUNCTION public.deals_log_created()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.deal_activities (deal_id, activity_type, description, created_by)
  VALUES (
    NEW.id,
    'system',
    'Deal created at stage ' || NEW.stage::text,
    auth.uid()
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deals_log_created ON public.deals;
CREATE TRIGGER trg_deals_log_created
  AFTER INSERT ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.deals_log_created();

-- Manager check helper (used by RLS)
CREATE OR REPLACE FUNCTION public.is_deal_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_manager FROM public.agents WHERE id = auth.uid()),
    FALSE
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deals_agent_select ON public.deals;
CREATE POLICY deals_agent_select ON public.deals
  FOR SELECT TO authenticated
  USING (
    agent_id = auth.uid()
    OR agent_id IS NULL
    OR public.is_deal_manager()
  );

DROP POLICY IF EXISTS deals_agent_insert ON public.deals;
CREATE POLICY deals_agent_insert ON public.deals
  FOR INSERT TO authenticated
  WITH CHECK (
    agent_id = auth.uid()
    OR agent_id IS NULL
    OR public.is_deal_manager()
  );

DROP POLICY IF EXISTS deals_agent_update ON public.deals;
CREATE POLICY deals_agent_update ON public.deals
  FOR UPDATE TO authenticated
  USING (
    agent_id = auth.uid()
    OR agent_id IS NULL
    OR public.is_deal_manager()
  )
  WITH CHECK (
    agent_id = auth.uid()
    OR agent_id IS NULL
    OR public.is_deal_manager()
  );

DROP POLICY IF EXISTS deals_agent_delete ON public.deals;
CREATE POLICY deals_agent_delete ON public.deals
  FOR DELETE TO authenticated
  USING (
    agent_id = auth.uid()
    OR public.is_deal_manager()
  );

DROP POLICY IF EXISTS deal_activities_agent_select ON public.deal_activities;
CREATE POLICY deal_activities_agent_select ON public.deal_activities
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deals d
      WHERE d.id = deal_activities.deal_id
        AND (
          d.agent_id = auth.uid()
          OR d.agent_id IS NULL
          OR public.is_deal_manager()
        )
    )
  );

DROP POLICY IF EXISTS deal_activities_agent_insert ON public.deal_activities;
CREATE POLICY deal_activities_agent_insert ON public.deal_activities
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.deals d
      WHERE d.id = deal_activities.deal_id
        AND (
          d.agent_id = auth.uid()
          OR d.agent_id IS NULL
          OR public.is_deal_manager()
        )
    )
  );
