-- 034: UAE-specific property fields
-- Size is stored in existing column `sqft` (UI labels it as sqm).
-- Additive — does not change RLS, commissions, or auth.

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS handover_quarter text;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS is_freehold boolean DEFAULT true;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS district_stage integer;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS developer_track_record text;

-- Enforce district_stage values (nullable allowed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'properties_district_stage_check'
  ) THEN
    ALTER TABLE public.properties
      ADD CONSTRAINT properties_district_stage_check
      CHECK (district_stage IS NULL OR district_stage IN (1, 2, 3, 4));
  END IF;
END $$;

-- Generated AED / sqm from price ÷ sqft (size column)
ALTER TABLE public.properties DROP COLUMN IF EXISTS price_per_sqm;

ALTER TABLE public.properties
  ADD COLUMN price_per_sqm numeric
  GENERATED ALWAYS AS (
    CASE
      WHEN sqft IS NOT NULL AND sqft > 0 AND price IS NOT NULL
      THEN ROUND((price / sqft)::numeric, 2)
      ELSE NULL
    END
  ) STORED;

COMMENT ON COLUMN public.properties.handover_quarter IS
  'Off-plan handover window, e.g. Q4 2027';
COMMENT ON COLUMN public.properties.is_freehold IS
  'True when foreigners can own (freehold zone)';
COMMENT ON COLUMN public.properties.district_stage IS
  '1=Early Speculation, 2=Infrastructure Arrival, 3=Community Maturity, 4=Saturation';
COMMENT ON COLUMN public.properties.developer_track_record IS
  'Short developer credibility note for listings';
COMMENT ON COLUMN public.properties.price_per_sqm IS
  'AED per sqm; generated from price / sqft';

CREATE INDEX IF NOT EXISTS idx_properties_is_freehold
  ON public.properties (is_freehold)
  WHERE is_freehold = true;

CREATE INDEX IF NOT EXISTS idx_properties_district_stage
  ON public.properties (district_stage)
  WHERE district_stage IS NOT NULL;

NOTIFY pgrst, 'reload schema';
