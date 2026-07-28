-- Track the leads RLS fix applied in the Supabase SQL editor (2026-07-23).
-- Live verification: Agent A can no longer SELECT/UPDATE Agent B's assigned leads;
-- DELETE remains manager-only; agent_id IS NULL remains a shared claim pool.
--
-- Idempotent: drops known policy names before recreate so staging/other envs match.
-- service_role (webhook-server / Next.js API) bypasses RLS automatically.

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leads_agent_select ON public.leads;
DROP POLICY IF EXISTS leads_agent_insert ON public.leads;
DROP POLICY IF EXISTS leads_agent_update ON public.leads;
DROP POLICY IF EXISTS leads_agent_delete ON public.leads;

CREATE POLICY leads_agent_select ON public.leads
  FOR SELECT TO authenticated
  USING (
    agent_id = auth.uid()
    OR agent_id IS NULL
    OR public.is_deal_manager()
  );

CREATE POLICY leads_agent_insert ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (
    agent_id = auth.uid()
    OR agent_id IS NULL
    OR public.is_deal_manager()
  );

CREATE POLICY leads_agent_update ON public.leads
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

CREATE POLICY leads_agent_delete ON public.leads
  FOR DELETE TO authenticated
  USING (public.is_deal_manager());
