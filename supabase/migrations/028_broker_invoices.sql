-- Broker invoices layered on deals commissions (commission_id = deals.id).
-- Does not alter deals / commission_status transitions.
-- "payable" in product language ≈ commission_status = 'approved'.

CREATE TABLE IF NOT EXISTS public.broker_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  commission_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  amount numeric(14, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'partial')),
  payment_method text,
  emi_plan boolean NOT NULL DEFAULT false,
  amount_paid numeric(14, 2) NOT NULL DEFAULT 0,
  due_date date,
  paid_at timestamptz,
  pdf_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT broker_invoices_commission_unique UNIQUE (commission_id)
);

CREATE INDEX IF NOT EXISTS idx_broker_invoices_broker_id ON public.broker_invoices (broker_id);
CREATE INDEX IF NOT EXISTS idx_broker_invoices_status ON public.broker_invoices (status);
CREATE INDEX IF NOT EXISTS idx_broker_invoices_due_date ON public.broker_invoices (due_date);

CREATE OR REPLACE FUNCTION public.set_broker_invoices_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_broker_invoices_updated_at ON public.broker_invoices;
CREATE TRIGGER trg_broker_invoices_updated_at
  BEFORE UPDATE ON public.broker_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.set_broker_invoices_updated_at();

ALTER TABLE public.broker_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS broker_invoices_select ON public.broker_invoices;
CREATE POLICY broker_invoices_select ON public.broker_invoices
  FOR SELECT TO authenticated
  USING (
    broker_id = auth.uid()
    OR public.is_deal_manager()
  );

DROP POLICY IF EXISTS broker_invoices_insert ON public.broker_invoices;
CREATE POLICY broker_invoices_insert ON public.broker_invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    broker_id = auth.uid()
    OR public.is_deal_manager()
  );

DROP POLICY IF EXISTS broker_invoices_update ON public.broker_invoices;
CREATE POLICY broker_invoices_update ON public.broker_invoices
  FOR UPDATE TO authenticated
  USING (
    broker_id = auth.uid()
    OR public.is_deal_manager()
  )
  WITH CHECK (
    broker_id = auth.uid()
    OR public.is_deal_manager()
  );

DROP POLICY IF EXISTS broker_invoices_delete ON public.broker_invoices;
CREATE POLICY broker_invoices_delete ON public.broker_invoices
  FOR DELETE TO authenticated
  USING (public.is_deal_manager());

NOTIFY pgrst, 'reload schema';
