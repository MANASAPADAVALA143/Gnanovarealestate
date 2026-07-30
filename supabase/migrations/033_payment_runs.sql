-- 033: Broker invoice payment runs (bulk mark paid)
-- Additive — does not change single mark-paid / EMI handlers.

ALTER TABLE public.broker_invoices
  ADD COLUMN IF NOT EXISTS payment_reference text;

COMMENT ON COLUMN public.broker_invoices.payment_reference IS
  'Bank ref / cheque / txn id from a payment run or manual mark-paid.';

CREATE TABLE IF NOT EXISTS public.payment_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text NOT NULL
    CHECK (payment_method IN ('bank_transfer', 'cheque', 'cash', 'online')),
  payment_reference text NOT NULL,
  total_amount_aed numeric(12, 2) NOT NULL DEFAULT 0
    CHECK (total_amount_aed >= 0),
  invoice_count integer NOT NULL DEFAULT 0
    CHECK (invoice_count >= 0),
  notes text,
  created_by uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_runs_run_date
  ON public.payment_runs (run_date DESC);
CREATE INDEX IF NOT EXISTS idx_payment_runs_created_by
  ON public.payment_runs (created_by);

CREATE TABLE IF NOT EXISTS public.payment_run_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_run_id uuid NOT NULL REFERENCES public.payment_runs(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.broker_invoices(id) ON DELETE RESTRICT,
  amount_aed numeric(12, 2) NOT NULL DEFAULT 0
    CHECK (amount_aed >= 0),
  broker_agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  CONSTRAINT payment_run_items_invoice_unique UNIQUE (invoice_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_run_items_run
  ON public.payment_run_items (payment_run_id);
CREATE INDEX IF NOT EXISTS idx_payment_run_items_broker
  ON public.payment_run_items (broker_agent_id);

ALTER TABLE public.payment_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_run_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_runs_select ON public.payment_runs;
CREATE POLICY payment_runs_select ON public.payment_runs
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS payment_runs_insert ON public.payment_runs;
CREATE POLICY payment_runs_insert ON public.payment_runs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_deal_manager());

DROP POLICY IF EXISTS payment_runs_update ON public.payment_runs;
CREATE POLICY payment_runs_update ON public.payment_runs
  FOR UPDATE TO authenticated
  USING (public.is_deal_manager())
  WITH CHECK (public.is_deal_manager());

DROP POLICY IF EXISTS payment_runs_delete ON public.payment_runs;
CREATE POLICY payment_runs_delete ON public.payment_runs
  FOR DELETE TO authenticated
  USING (public.is_deal_manager());

DROP POLICY IF EXISTS payment_run_items_select ON public.payment_run_items;
CREATE POLICY payment_run_items_select ON public.payment_run_items
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS payment_run_items_insert ON public.payment_run_items;
CREATE POLICY payment_run_items_insert ON public.payment_run_items
  FOR INSERT TO authenticated
  WITH CHECK (public.is_deal_manager());

DROP POLICY IF EXISTS payment_run_items_update ON public.payment_run_items;
CREATE POLICY payment_run_items_update ON public.payment_run_items
  FOR UPDATE TO authenticated
  USING (public.is_deal_manager())
  WITH CHECK (public.is_deal_manager());

DROP POLICY IF EXISTS payment_run_items_delete ON public.payment_run_items;
CREATE POLICY payment_run_items_delete ON public.payment_run_items
  FOR DELETE TO authenticated
  USING (public.is_deal_manager());

NOTIFY pgrst, 'reload schema';
