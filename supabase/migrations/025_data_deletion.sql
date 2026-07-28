-- Fix #4b: UAE PDPL "Right to be Forgotten" — deletion RPC + audit log

CREATE TABLE IF NOT EXISTS public.data_deletion_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      UUID NOT NULL,
  deleted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_by   UUID,
  summary      JSONB,
  request_ref  TEXT
);

ALTER TABLE public.data_deletion_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deletion_log_manager_select ON public.data_deletion_log;
CREATE POLICY deletion_log_manager_select ON public.data_deletion_log
  FOR SELECT TO authenticated
  USING (public.is_deal_manager());

COMMENT ON TABLE public.data_deletion_log IS
  'UAE PDPL deletion audit trail. Never delete rows from this table.';

CREATE OR REPLACE FUNCTION public.delete_lead_data(
  p_lead_id UUID,
  p_deleted_by UUID DEFAULT NULL,
  p_request_ref TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB := '{}'::jsonb;
  v_count  INT;
BEGIN
  IF p_lead_id IS NULL THEN
    RAISE EXCEPTION 'lead_id is required';
  END IF;

  -- WhatsApp inbox threads (if table exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'whatsapp_threads'
  ) THEN
    DELETE FROM public.whatsapp_threads WHERE lead_id = p_lead_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('whatsapp_threads_deleted', v_count);
  END IF;

  -- Calls + transcripts
  DELETE FROM public.calls WHERE lead_id = p_lead_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('calls_deleted', v_count);

  -- CRM tasks (if table exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'lead_tasks'
  ) THEN
    DELETE FROM public.lead_tasks WHERE lead_id = p_lead_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('tasks_deleted', v_count);
  END IF;

  -- Appointments / bookings (if table exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'bookings'
  ) THEN
    DELETE FROM public.bookings WHERE lead_id = p_lead_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('bookings_deleted', v_count);
  END IF;

  -- Viewings
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'viewings'
  ) THEN
    EXECUTE 'DELETE FROM public.viewings WHERE lead_id = $1' USING p_lead_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('viewings_deleted', v_count);
  END IF;

  -- Campaign membership
  DELETE FROM public.campaign_leads WHERE lead_id = p_lead_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('campaign_entries_deleted', v_count);

  -- Activity + consent records
  DELETE FROM public.lead_activities WHERE lead_id = p_lead_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('activities_deleted', v_count);

  DELETE FROM public.lead_consent WHERE lead_id = p_lead_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('lead_consent_deleted', v_count);

  -- Deals tied to lead (commission data lives on deals)
  DELETE FROM public.deals WHERE lead_id = p_lead_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('deals_deleted', v_count);

  -- Open house attendees — anonymise PII, keep aggregate stats
  UPDATE public.open_house_attendees
  SET name = '[deleted]', phone = '[deleted]', email = NULL
  WHERE lead_id = p_lead_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('open_house_attendees_anonymised', v_count);

  -- consent_log — anonymise (retain audit row)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'consent_log'
  ) THEN
    UPDATE public.consent_log
    SET email = '[deleted]', phone = '[deleted]', user_agent = '[deleted]'
    WHERE lead_id = p_lead_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || jsonb_build_object('consent_logs_anonymised', v_count);
  END IF;

  -- Lead row
  DELETE FROM public.leads WHERE id = p_lead_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('lead_deleted', v_count);

  INSERT INTO public.data_deletion_log (lead_id, deleted_at, deleted_by, summary, request_ref)
  VALUES (p_lead_id, NOW(), p_deleted_by, v_result, p_request_ref);

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_lead_data(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_lead_data(UUID, UUID, TEXT) TO service_role;
