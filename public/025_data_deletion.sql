-- ============================================================
-- Fix #4b: Data deletion endpoint support
-- UAE PDPL "Right to be Forgotten"
-- supabase/migrations/025_data_deletion.sql
-- ============================================================

-- Stored procedure: hard delete a lead and all related data
-- Called from your admin API with service_role key only
CREATE OR REPLACE FUNCTION delete_lead_data(p_lead_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER  -- runs as superuser so it can delete across tables
AS $$
DECLARE
  v_result JSONB := '{}';
  v_count  INT;
BEGIN
  -- 1. Delete WhatsApp threads
  DELETE FROM whatsapp_inbox WHERE lead_id = p_lead_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('whatsapp_messages_deleted', v_count);

  -- 2. Delete calls + transcripts
  DELETE FROM calls WHERE lead_id = p_lead_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('calls_deleted', v_count);

  -- 3. Delete tasks
  DELETE FROM tasks WHERE lead_id = p_lead_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('tasks_deleted', v_count);

  -- 4. Delete appointments
  DELETE FROM appointments WHERE lead_id = p_lead_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('appointments_deleted', v_count);

  -- 5. Remove from campaign_leads
  DELETE FROM campaign_leads WHERE lead_id = p_lead_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('campaign_entries_deleted', v_count);

  -- 6. Anonymise consent_log (keep for legal audit but remove PII)
  UPDATE consent_log
  SET
    email    = '[deleted]',
    phone    = '[deleted]',
    user_agent = '[deleted]'
  WHERE lead_id = p_lead_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('consent_logs_anonymised', v_count);

  -- 7. Delete the lead record itself
  DELETE FROM leads WHERE id = p_lead_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || jsonb_build_object('lead_deleted', v_count);

  -- 8. Log the deletion event (for PDPL audit)
  INSERT INTO data_deletion_log (lead_id, deleted_at, deleted_by, summary)
  VALUES (p_lead_id, NOW(), auth.uid(), v_result);

  RETURN v_result;
END;
$$;

-- Deletion audit log (required by UAE PDPL — keep permanently)
CREATE TABLE IF NOT EXISTS data_deletion_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID NOT NULL,
  deleted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_by  UUID,          -- agent/admin who triggered the deletion
  summary     JSONB,         -- what was deleted
  request_ref TEXT           -- optional: reference number from the data subject request
);

ALTER TABLE data_deletion_log ENABLE ROW LEVEL SECURITY;

-- Only managers can view deletion log
CREATE POLICY "deletion_log_select"
  ON data_deletion_log FOR SELECT
  USING (is_manager());

COMMENT ON TABLE data_deletion_log IS
  'UAE PDPL deletion audit trail. Never delete rows from this table.';
