-- Commission status workflow on existing deals table
-- Depends on: public.deals, public.deal_activities (migration 019_deals_module.sql)

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.commission_status AS ENUM (
    'pending',
    'submitted',
    'approved',
    'paid'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Extend deal_activity_type (idempotent)
DO $$ BEGIN
  ALTER TYPE public.deal_activity_type ADD VALUE 'commission_status_change';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Columns on deals
-- ---------------------------------------------------------------------------

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS commission_status public.commission_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS commission_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS commission_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS commission_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS commission_payment_reference TEXT;

CREATE INDEX IF NOT EXISTS idx_deals_commission_status
  ON public.deals(commission_status);

CREATE INDEX IF NOT EXISTS idx_deals_agent_commission_status
  ON public.deals(agent_id, commission_status);

-- ---------------------------------------------------------------------------
-- Status transition helper
-- Allowed: one step forward (pending→submitted→approved→paid)
--          OR reset to pending from any status (correction)
-- Disallowed: skipping steps (e.g. pending→paid)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.commission_status_rank(p_status public.commission_status)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_status
    WHEN 'pending' THEN 0
    WHEN 'submitted' THEN 1
    WHEN 'approved' THEN 2
    WHEN 'paid' THEN 3
    ELSE -1
  END;
$$;

CREATE OR REPLACE FUNCTION public.commission_status_transition_allowed(
  p_old public.commission_status,
  p_new public.commission_status
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    p_old IS NOT DISTINCT FROM p_new
    OR p_new = 'pending'::public.commission_status
    OR public.commission_status_rank(p_new) = public.commission_status_rank(p_old) + 1;
$$;

-- ---------------------------------------------------------------------------
-- Trigger: validate transitions, set timestamps, log activity
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.deals_on_commission_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_desc TEXT;
BEGIN
  IF TG_OP <> 'UPDATE' OR NEW.commission_status IS NOT DISTINCT FROM OLD.commission_status THEN
    RETURN NEW;
  END IF;

  IF NOT public.commission_status_transition_allowed(OLD.commission_status, NEW.commission_status) THEN
    RAISE EXCEPTION
      'Invalid commission status transition: % → %. Allowed: one step forward (pending→submitted→approved→paid) or reset to pending.',
      OLD.commission_status,
      NEW.commission_status;
  END IF;

  -- Reset correction: clear downstream timestamps and payment ref
  IF NEW.commission_status = 'pending'::public.commission_status
     AND OLD.commission_status <> 'pending'::public.commission_status THEN
    NEW.commission_submitted_at := NULL;
    NEW.commission_approved_at := NULL;
    NEW.commission_paid_at := NULL;
    NEW.commission_payment_reference := NULL;
  END IF;

  -- Set timestamp for the new status (only if not already set)
  IF NEW.commission_status = 'submitted'::public.commission_status
     AND NEW.commission_submitted_at IS NULL THEN
    NEW.commission_submitted_at := NOW();
  ELSIF NEW.commission_status = 'approved'::public.commission_status
     AND NEW.commission_approved_at IS NULL THEN
    NEW.commission_approved_at := NOW();
  ELSIF NEW.commission_status = 'paid'::public.commission_status
     AND NEW.commission_paid_at IS NULL THEN
    NEW.commission_paid_at := NOW();
  END IF;

  v_desc := 'Commission status changed from ' || OLD.commission_status::text
    || ' to ' || NEW.commission_status::text;

  IF NEW.commission_status = 'paid'::public.commission_status
     AND NEW.commission_payment_reference IS NOT NULL
     AND trim(NEW.commission_payment_reference) <> '' THEN
    v_desc := v_desc || ' (ref: ' || trim(NEW.commission_payment_reference) || ')';
  END IF;

  INSERT INTO public.deal_activities (deal_id, activity_type, description, created_by)
  VALUES (
    NEW.id,
    'commission_status_change',
    v_desc,
    auth.uid()
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deals_commission_status_change ON public.deals;
CREATE TRIGGER trg_deals_commission_status_change
  BEFORE UPDATE OF commission_status, commission_payment_reference ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.deals_on_commission_status_change();
