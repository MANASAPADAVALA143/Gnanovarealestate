-- 035: Property payment plans (off-plan milestones)
-- Additive — does not change deals, commissions, or payment runs.

CREATE TABLE IF NOT EXISTS public.property_payment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  milestone text NOT NULL,
  percentage numeric(5, 2) NOT NULL
    CHECK (percentage >= 0 AND percentage <= 100),
  due_date text,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_payment_plans_property
  ON public.property_payment_plans (property_id, sort_order ASC);

ALTER TABLE public.property_payment_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS property_payment_plans_select ON public.property_payment_plans;
CREATE POLICY property_payment_plans_select ON public.property_payment_plans
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS property_payment_plans_insert ON public.property_payment_plans;
CREATE POLICY property_payment_plans_insert ON public.property_payment_plans
  FOR INSERT TO authenticated
  WITH CHECK (public.is_deal_manager());

DROP POLICY IF EXISTS property_payment_plans_update ON public.property_payment_plans;
CREATE POLICY property_payment_plans_update ON public.property_payment_plans
  FOR UPDATE TO authenticated
  USING (public.is_deal_manager())
  WITH CHECK (public.is_deal_manager());

DROP POLICY IF EXISTS property_payment_plans_delete ON public.property_payment_plans;
CREATE POLICY property_payment_plans_delete ON public.property_payment_plans
  FOR DELETE TO authenticated
  USING (public.is_deal_manager());

COMMENT ON TABLE public.property_payment_plans IS
  'Off-plan payment milestones per property (booking / construction / handover).';

NOTIFY pgrst, 'reload schema';
