-- Patch RLS gaps left by 024_rls_policies.sql
-- Uses existing helpers: auth.uid() = agents.id, public.is_deal_manager()
-- service_role (webhook-server / Next.js API) bypasses RLS automatically.

-- ---------------------------------------------------------------------------
-- 1. AGENTS — enable RLS, self+manager only, safe directory view for others
-- ---------------------------------------------------------------------------
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own agent" ON public.agents;
DROP POLICY IF EXISTS "Users can insert own agent" ON public.agents;
DROP POLICY IF EXISTS "Users can update own agent" ON public.agents;

-- Base table: self + manager only (protects email, phone, Stripe billing fields)
DROP POLICY IF EXISTS agents_manager_select ON public.agents;
CREATE POLICY agents_manager_select ON public.agents
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_deal_manager());

-- Signup: user inserts their own row
DROP POLICY IF EXISTS agents_self_insert ON public.agents;
CREATE POLICY agents_self_insert ON public.agents
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- Self-update or manager override
DROP POLICY IF EXISTS agents_self_or_manager_update ON public.agents;
CREATE POLICY agents_self_or_manager_update ON public.agents
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_deal_manager());

DROP POLICY IF EXISTS agents_manager_delete ON public.agents;
CREATE POLICY agents_manager_delete ON public.agents
  FOR DELETE TO authenticated
  USING (public.is_deal_manager());

-- Safe directory view — id, full_name, availability (no email/phone/billing)
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT TRUE;

CREATE OR REPLACE VIEW public.agents_directory AS
  SELECT id, full_name, is_available FROM public.agents;

GRANT SELECT ON public.agents_directory TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. SPEED_TO_LEAD_LOG — service_role only (no anon/authenticated policies)
-- ---------------------------------------------------------------------------
ALTER TABLE public.speed_to_lead_log ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies for anon/authenticated → deny all except service_role.
