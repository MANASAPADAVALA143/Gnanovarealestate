-- 036: Property image URL + UAE listing fields (completion, service charge, RERA, parking)

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS completion_status TEXT,
  ADD COLUMN IF NOT EXISTS service_charge NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS rera_permit TEXT,
  ADD COLUMN IF NOT EXISTS parking_spaces INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'properties_completion_status_check'
  ) THEN
    ALTER TABLE public.properties
      ADD CONSTRAINT properties_completion_status_check
      CHECK (
        completion_status IS NULL
        OR completion_status IN ('off_plan', 'ready', 'under_construction')
      );
  END IF;
END $$;

COMMENT ON COLUMN public.properties.image_url IS
  'Primary listing photo public URL (Supabase Storage property-images bucket).';
COMMENT ON COLUMN public.properties.completion_status IS
  'UAE status: off_plan | ready | under_construction';
COMMENT ON COLUMN public.properties.service_charge IS
  'Annual service charge in AED';
COMMENT ON COLUMN public.properties.rera_permit IS
  'RERA permit / ORN number';
COMMENT ON COLUMN public.properties.parking_spaces IS
  'Number of parking spaces';

-- Public storage bucket for listing photos (create policies if storage schema exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-images', 'property-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "property_images_public_read" ON storage.objects;
CREATE POLICY "property_images_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'property-images');

DROP POLICY IF EXISTS "property_images_auth_insert" ON storage.objects;
CREATE POLICY "property_images_auth_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'property-images');

DROP POLICY IF EXISTS "property_images_auth_update" ON storage.objects;
CREATE POLICY "property_images_auth_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'property-images');

DROP POLICY IF EXISTS "property_images_auth_delete" ON storage.objects;
CREATE POLICY "property_images_auth_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'property-images');

-- Service role / anon upload fallback for Express + preview demos (bucket still public-read)
DROP POLICY IF EXISTS "property_images_anon_insert" ON storage.objects;
CREATE POLICY "property_images_anon_insert"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'property-images');

NOTIFY pgrst, 'reload schema';
