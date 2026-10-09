-- Workspaces: separate client projects (Venkateswara Suites, Viseshta Avenues) inside one CRM.
-- Existing leads/properties are assigned to Venkateswara Suites; any insert that does not
-- specify a workspace (legacy webhooks, Vite app, scripts) also lands there via trigger.

CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS workspaces_single_default
  ON public.workspaces (is_default) WHERE is_default;

INSERT INTO public.workspaces (slug, name, is_default)
VALUES
  ('venkateswara-suites', 'Venkateswara Suites', TRUE),
  ('viseshta-avenues', 'Viseshta Avenues', FALSE)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspaces_authenticated_select ON public.workspaces;
CREATE POLICY workspaces_authenticated_select ON public.workspaces
  FOR SELECT TO authenticated
  USING (true);

-- Leads -----------------------------------------------------------------------

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id),
  ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.leads
SET workspace_id = (SELECT id FROM public.workspaces WHERE is_default)
WHERE workspace_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_leads_workspace_created
  ON public.leads (workspace_id, created_at DESC);

-- Properties ------------------------------------------------------------------

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id),
  ADD COLUMN IF NOT EXISTS monthly_rental NUMERIC,
  ADD COLUMN IF NOT EXISTS total_units INTEGER,
  ADD COLUMN IF NOT EXISTS available_units INTEGER,
  ADD COLUMN IF NOT EXISTS yearly_appreciation_pct NUMERIC,
  ADD COLUMN IF NOT EXISTS security_note TEXT;

UPDATE public.properties
SET workspace_id = (SELECT id FROM public.workspaces WHERE is_default)
WHERE workspace_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_properties_workspace ON public.properties (workspace_id);

-- Default workspace on insert -------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_default_workspace_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.workspace_id IS NULL THEN
    SELECT id INTO NEW.workspace_id FROM public.workspaces WHERE is_default LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leads_default_workspace ON public.leads;
CREATE TRIGGER trg_leads_default_workspace
  BEFORE INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.set_default_workspace_id();

DROP TRIGGER IF EXISTS trg_properties_default_workspace ON public.properties;
CREATE TRIGGER trg_properties_default_workspace
  BEFORE INSERT ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.set_default_workspace_id();

-- Pipeline stages used by the Viseshta Avenues pipeline -----------------------

ALTER TYPE public.pipeline_stage ADD VALUE IF NOT EXISTS 'brochure_sent';
ALTER TYPE public.pipeline_stage ADD VALUE IF NOT EXISTS 'meeting_scheduled';
ALTER TYPE public.pipeline_stage ADD VALUE IF NOT EXISTS 'site_visit';
ALTER TYPE public.pipeline_stage ADD VALUE IF NOT EXISTS 'registered';

-- Viseshta Avenues property ---------------------------------------------------

INSERT INTO public.properties (
  workspace_id,
  title,
  property_type,
  address,
  city,
  state,
  zip_code,
  country,
  price,
  monthly_rental,
  total_units,
  available_units,
  yearly_appreciation_pct,
  security_note,
  description,
  status
)
SELECT
  w.id,
  'Viseshta Avenues',
  'commercial_coworking',
  '7G Vyshnavi Cynosure, Gachibowli',
  'Hyderabad',
  'Telangana',
  '500032',
  'India',
  3000000,
  25000,
  69,
  69,
  5,
  '100% Bank Guaranteed',
  'Commercial co-working units at Vyshnavi Cynosure, Gachibowli. ₹30,00,000 per unit, ₹25,000 monthly rental, 5% yearly appreciation, 100% bank guaranteed.',
  'active'
FROM public.workspaces w
WHERE w.slug = 'viseshta-avenues'
  AND NOT EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.workspace_id = w.id AND p.title = 'Viseshta Avenues'
  );
