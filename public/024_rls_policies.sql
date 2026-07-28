-- ============================================================
-- Fix #4: Row Level Security (RLS) for all Gnanova tables
-- Run in Supabase SQL Editor
-- supabase/migrations/024_rls_policies.sql
-- ============================================================
-- HOW IT WORKS:
-- auth.uid()        = the logged-in agent's Supabase user ID
-- auth.role()       = 'authenticated' | 'anon' | 'service_role'
-- service_role key  = your backend (webhook-server, Next.js API routes)
--                     bypasses RLS automatically — no policy needed
-- ============================================================

-- ─── HELPER: get current agent's id from agents table ────────
-- Called inside policies so each agent only sees their own rows
CREATE OR REPLACE FUNCTION get_my_agent_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM agents WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ─── HELPER: is current user a manager/admin? ────────────────
CREATE OR REPLACE FUNCTION is_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM agents
    WHERE user_id = auth.uid()
    AND role IN ('manager', 'admin', 'super_admin')
  );
$$;

-- ============================================================
-- 1. LEADS
-- ============================================================
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Agents see only their own leads; managers see all
CREATE POLICY "leads_select"
  ON leads FOR SELECT
  USING (
    agent_id = get_my_agent_id()
    OR is_manager()
  );

-- Agents can create leads assigned to themselves
CREATE POLICY "leads_insert"
  ON leads FOR INSERT
  WITH CHECK (
    agent_id = get_my_agent_id()
    OR is_manager()
  );

-- Agents can update their own leads; managers can update any
CREATE POLICY "leads_update"
  ON leads FOR UPDATE
  USING (
    agent_id = get_my_agent_id()
    OR is_manager()
  );

-- Only managers can delete leads
CREATE POLICY "leads_delete"
  ON leads FOR DELETE
  USING (is_manager());

-- ============================================================
-- 2. CALLS
-- ============================================================
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calls_select"
  ON calls FOR SELECT
  USING (
    agent_id = get_my_agent_id()
    OR is_manager()
  );

CREATE POLICY "calls_insert"
  ON calls FOR INSERT
  WITH CHECK (
    agent_id = get_my_agent_id()
    OR is_manager()
  );

-- Calls are immutable for agents; managers can update (e.g. outcome correction)
CREATE POLICY "calls_update"
  ON calls FOR UPDATE
  USING (is_manager());

CREATE POLICY "calls_delete"
  ON calls FOR DELETE
  USING (is_manager());

-- ============================================================
-- 3. DEALS
-- ============================================================
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deals_select"
  ON deals FOR SELECT
  USING (
    agent_id = get_my_agent_id()
    OR is_manager()
  );

CREATE POLICY "deals_insert"
  ON deals FOR INSERT
  WITH CHECK (
    agent_id = get_my_agent_id()
    OR is_manager()
  );

CREATE POLICY "deals_update"
  ON deals FOR UPDATE
  USING (
    agent_id = get_my_agent_id()
    OR is_manager()
  );

CREATE POLICY "deals_delete"
  ON deals FOR DELETE
  USING (is_manager());

-- ============================================================
-- 4. COMMISSIONS
-- ============================================================
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;

-- Agents see their own commissions; managers see all
CREATE POLICY "commissions_select"
  ON commissions FOR SELECT
  USING (
    agent_id = get_my_agent_id()
    OR is_manager()
  );

CREATE POLICY "commissions_insert"
  ON commissions FOR INSERT
  WITH CHECK (
    agent_id = get_my_agent_id()
    OR is_manager()
  );

-- Agents can update their own pending commissions; managers can update any
CREATE POLICY "commissions_update"
  ON commissions FOR UPDATE
  USING (
    (agent_id = get_my_agent_id() AND status = 'pending')
    OR is_manager()
  );

-- Only managers can delete commissions
CREATE POLICY "commissions_delete"
  ON commissions FOR DELETE
  USING (is_manager());

-- ============================================================
-- 5. TASKS
-- ============================================================
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_select"
  ON tasks FOR SELECT
  USING (
    agent_id = get_my_agent_id()
    OR is_manager()
  );

CREATE POLICY "tasks_insert"
  ON tasks FOR INSERT
  WITH CHECK (
    agent_id = get_my_agent_id()
    OR is_manager()
  );

CREATE POLICY "tasks_update"
  ON tasks FOR UPDATE
  USING (
    agent_id = get_my_agent_id()
    OR is_manager()
  );

CREATE POLICY "tasks_delete"
  ON tasks FOR DELETE
  USING (
    agent_id = get_my_agent_id()
    OR is_manager()
  );

-- ============================================================
-- 6. PROPERTIES
-- ============================================================
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- All authenticated agents can view properties (shared inventory)
CREATE POLICY "properties_select"
  ON properties FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only managers can add/edit/delete properties
CREATE POLICY "properties_insert"
  ON properties FOR INSERT
  WITH CHECK (is_manager());

CREATE POLICY "properties_update"
  ON properties FOR UPDATE
  USING (is_manager());

CREATE POLICY "properties_delete"
  ON properties FOR DELETE
  USING (is_manager());

-- ============================================================
-- 7. APPOINTMENTS / BOOKINGS
-- ============================================================
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appointments_select"
  ON appointments FOR SELECT
  USING (
    agent_id = get_my_agent_id()
    OR is_manager()
  );

CREATE POLICY "appointments_insert"
  ON appointments FOR INSERT
  WITH CHECK (
    agent_id = get_my_agent_id()
    OR is_manager()
  );

CREATE POLICY "appointments_update"
  ON appointments FOR UPDATE
  USING (
    agent_id = get_my_agent_id()
    OR is_manager()
  );

CREATE POLICY "appointments_delete"
  ON appointments FOR DELETE
  USING (
    agent_id = get_my_agent_id()
    OR is_manager()
  );

-- ============================================================
-- 8. WHATSAPP INBOX
-- ============================================================
ALTER TABLE whatsapp_inbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_select"
  ON whatsapp_inbox FOR SELECT
  USING (
    agent_id = get_my_agent_id()
    OR is_manager()
  );

-- Inserts come from the webhook server (service_role) — no agent policy needed
-- But allow agents to insert manual messages
CREATE POLICY "whatsapp_insert"
  ON whatsapp_inbox FOR INSERT
  WITH CHECK (
    agent_id = get_my_agent_id()
    OR is_manager()
  );

CREATE POLICY "whatsapp_update"
  ON whatsapp_inbox FOR UPDATE
  USING (
    agent_id = get_my_agent_id()
    OR is_manager()
  );

-- ============================================================
-- 9. OUTBOUND CAMPAIGNS + CAMPAIGN LEADS
-- ============================================================
ALTER TABLE outbound_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaigns_select"
  ON outbound_campaigns FOR SELECT
  USING (
    created_by = get_my_agent_id()
    OR is_manager()
  );

CREATE POLICY "campaigns_insert"
  ON outbound_campaigns FOR INSERT
  WITH CHECK (is_manager());

CREATE POLICY "campaigns_update"
  ON outbound_campaigns FOR UPDATE
  USING (is_manager());

CREATE POLICY "campaigns_delete"
  ON outbound_campaigns FOR DELETE
  USING (is_manager());

-- Campaign leads — follow campaign visibility
ALTER TABLE campaign_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaign_leads_select"
  ON campaign_leads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM outbound_campaigns c
      WHERE c.id = campaign_id
      AND (c.created_by = get_my_agent_id() OR is_manager())
    )
  );

CREATE POLICY "campaign_leads_insert"
  ON campaign_leads FOR INSERT
  WITH CHECK (is_manager());

-- ============================================================
-- 10. OPEN HOUSE EVENTS + ATTENDEES
-- ============================================================
ALTER TABLE open_house_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open_house_events_select"
  ON open_house_events FOR SELECT
  USING (
    agent_id = get_my_agent_id()
    OR is_manager()
  );

CREATE POLICY "open_house_events_insert"
  ON open_house_events FOR INSERT
  WITH CHECK (
    agent_id = get_my_agent_id()
    OR is_manager()
  );

CREATE POLICY "open_house_events_update"
  ON open_house_events FOR UPDATE
  USING (
    agent_id = get_my_agent_id()
    OR is_manager()
  );

-- Open house attendees — public insert allowed (check-in kiosk)
-- but reads are restricted to the event's agent
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'open_house_attendees') THEN
    ALTER TABLE open_house_attendees ENABLE ROW LEVEL SECURITY;

    EXECUTE $policy$
      CREATE POLICY "attendees_select"
        ON open_house_attendees FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM open_house_events e
            WHERE e.id = event_id
            AND (e.agent_id = get_my_agent_id() OR is_manager())
          )
        )
    $policy$;

    -- Public insert so the check-in kiosk works without agent auth
    EXECUTE $policy$
      CREATE POLICY "attendees_public_insert"
        ON open_house_attendees FOR INSERT
        WITH CHECK (true)
    $policy$;
  END IF;
END $$;

-- ============================================================
-- 11. AGENTS TABLE
-- ============================================================
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- Agents can only see and edit their own profile
CREATE POLICY "agents_select"
  ON agents FOR SELECT
  USING (
    user_id = auth.uid()
    OR is_manager()
  );

CREATE POLICY "agents_update"
  ON agents FOR UPDATE
  USING (user_id = auth.uid());

-- Only admins can create or delete agent records
CREATE POLICY "agents_insert"
  ON agents FOR INSERT
  WITH CHECK (is_manager());

CREATE POLICY "agents_delete"
  ON agents FOR DELETE
  USING (is_manager());

-- ============================================================
-- 12. CONSENT LOG (already has RLS from migration 023)
-- ============================================================
-- No changes needed — already set in 023_consent_log.sql

-- ============================================================
-- 13. AGENT SETTINGS
-- ============================================================
ALTER TABLE agent_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_settings_select"
  ON agent_settings FOR SELECT
  USING (agent_id = get_my_agent_id() OR is_manager());

CREATE POLICY "agent_settings_update"
  ON agent_settings FOR UPDATE
  USING (agent_id = get_my_agent_id());

CREATE POLICY "agent_settings_insert"
  ON agent_settings FOR INSERT
  WITH CHECK (agent_id = get_my_agent_id());

-- ============================================================
-- 14. INTEGRATION SETTINGS
-- ============================================================
ALTER TABLE integration_settings ENABLE ROW LEVEL SECURITY;

-- Only managers can view/edit integration keys (VAPI keys, Twilio etc.)
CREATE POLICY "integration_settings_select"
  ON integration_settings FOR SELECT
  USING (is_manager());

CREATE POLICY "integration_settings_update"
  ON integration_settings FOR UPDATE
  USING (is_manager());

CREATE POLICY "integration_settings_insert"
  ON integration_settings FOR INSERT
  WITH CHECK (is_manager());

-- ============================================================
-- VERIFY: Check RLS is enabled on all tables
-- Run this after applying the migration to confirm
-- ============================================================
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
