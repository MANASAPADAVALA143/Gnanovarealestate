-- 031: Meta / portal ad spend (manual cost entry) for CPL attribution
-- Uses is_deal_manager() (is_manager OR is_owner after 030).

CREATE TABLE IF NOT EXISTS public.ad_spend_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start date NOT NULL,
  period_end date NOT NULL,
  source text NOT NULL
    CHECK (source IN (
      'facebook',
      'instagram',
      'meta_ads',
      'property_finder',
      'bayut',
      'website',
      'referral',
      'walk_in'
    )),
  campaign_name text,
  spend_aed numeric(12, 2) NOT NULL DEFAULT 0
    CHECK (spend_aed >= 0),
  created_by uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ad_spend_period_valid CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS idx_ad_spend_entries_period_start
  ON public.ad_spend_entries (period_start DESC);
CREATE INDEX IF NOT EXISTS idx_ad_spend_entries_source
  ON public.ad_spend_entries (source);
CREATE INDEX IF NOT EXISTS idx_ad_spend_entries_created_by
  ON public.ad_spend_entries (created_by);

CREATE OR REPLACE FUNCTION public.set_ad_spend_entries_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ad_spend_entries_updated_at ON public.ad_spend_entries;
CREATE TRIGGER trg_ad_spend_entries_updated_at
  BEFORE UPDATE ON public.ad_spend_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_ad_spend_entries_updated_at();

ALTER TABLE public.ad_spend_entries ENABLE ROW LEVEL SECURITY;

-- All authenticated agents can read (CPL visibility)
DROP POLICY IF EXISTS ad_spend_entries_select ON public.ad_spend_entries;
CREATE POLICY ad_spend_entries_select ON public.ad_spend_entries
  FOR SELECT TO authenticated
  USING (true);

-- Manager/owner write
DROP POLICY IF EXISTS ad_spend_entries_insert ON public.ad_spend_entries;
CREATE POLICY ad_spend_entries_insert ON public.ad_spend_entries
  FOR INSERT TO authenticated
  WITH CHECK (public.is_deal_manager());

DROP POLICY IF EXISTS ad_spend_entries_update ON public.ad_spend_entries;
CREATE POLICY ad_spend_entries_update ON public.ad_spend_entries
  FOR UPDATE TO authenticated
  USING (public.is_deal_manager())
  WITH CHECK (public.is_deal_manager());

DROP POLICY IF EXISTS ad_spend_entries_delete ON public.ad_spend_entries;
CREATE POLICY ad_spend_entries_delete ON public.ad_spend_entries
  FOR DELETE TO authenticated
  USING (public.is_deal_manager());

NOTIFY pgrst, 'reload schema';
