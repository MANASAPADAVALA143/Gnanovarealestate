-- 030: Owner role + admin audit log
-- Extends existing is_deal_manager() so all manager RLS automatically includes owners.
-- Does not rewrite per-table policies.
--
-- IMPORTANT: agents_directory must DROP + CREATE (not CREATE OR REPLACE) when inserting
-- columns before broker_rank_score — Postgres 42P16 otherwise.

-- ---------------------------------------------------------------------------
-- 1. agents.is_owner
-- ---------------------------------------------------------------------------
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS is_owner BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.agents.is_owner IS
  'Brokerage owner. Superset of is_manager: all manager RLS + owner-only admin mutations.';

-- Owners are always treated as managers for existing gates
UPDATE public.agents
SET is_manager = true
WHERE is_owner = true AND is_manager = false;

-- ---------------------------------------------------------------------------
-- 2. Extend is_deal_manager() — single choke point for all existing RLS
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_deal_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT (is_manager OR is_owner)
      FROM public.agents
      WHERE id = auth.uid()
    ),
    FALSE
  );
$$;

-- Explicit owner helper (owner-only UI/API / privileged column guard)
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_owner FROM public.agents WHERE id = auth.uid()),
    FALSE
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. Privileged column guard
--    Managers already have UPDATE on agents (025). Only owners may change
--    is_owner / is_manager / rank fields via client JWT.
--    When auth.uid() IS NULL (service_role / backend jobs), allow writes so
--    calculateBrokerRank can update scores.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.agents_guard_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF (
    NEW.is_owner IS DISTINCT FROM OLD.is_owner
    OR NEW.is_manager IS DISTINCT FROM OLD.is_manager
    OR NEW.broker_rank_score IS DISTINCT FROM OLD.broker_rank_score
    OR NEW.rank_factors IS DISTINCT FROM OLD.rank_factors
    OR NEW.rank_updated_at IS DISTINCT FROM OLD.rank_updated_at
  ) AND NOT public.is_owner() THEN
    RAISE EXCEPTION 'Only owners may change role or rank fields';
  END IF;

  IF OLD.is_owner = true AND NEW.is_owner = false AND auth.uid() = OLD.id THEN
    RAISE EXCEPTION 'Cannot remove your own owner flag';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agents_guard_privileged_columns ON public.agents;
CREATE TRIGGER trg_agents_guard_privileged_columns
  BEFORE UPDATE ON public.agents
  FOR EACH ROW
  EXECUTE FUNCTION public.agents_guard_privileged_columns();

-- ---------------------------------------------------------------------------
-- 4. agents_directory — DROP required (column order / names changed vs 029)
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.agents_directory;

CREATE VIEW public.agents_directory AS
  SELECT
    id,
    full_name,
    is_available,
    is_manager,
    is_owner,
    broker_rank_score,
    rank_updated_at
  FROM public.agents;

GRANT SELECT ON public.agents_directory TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. admin_audit_log (append-only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  performed_by uuid NOT NULL REFERENCES public.agents(id) ON DELETE RESTRICT,
  target_agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  old_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at
  ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_performed_by
  ON public.admin_audit_log (performed_by);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target
  ON public.admin_audit_log (target_agent_id);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_audit_log_select ON public.admin_audit_log;
CREATE POLICY admin_audit_log_select ON public.admin_audit_log
  FOR SELECT TO authenticated
  USING (public.is_deal_manager());

DROP POLICY IF EXISTS admin_audit_log_insert ON public.admin_audit_log;
CREATE POLICY admin_audit_log_insert ON public.admin_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_owner()
    AND performed_by = auth.uid()
  );

-- No UPDATE / DELETE policies → append-only for authenticated

NOTIFY pgrst, 'reload schema';
