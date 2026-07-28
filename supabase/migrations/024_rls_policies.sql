-- Fix #4: Harden RLS across Gnanova tables (v2 — skips missing tables)
-- Uses existing helpers: auth.uid() = agents.id, public.is_deal_manager()
-- service_role (webhook-server / Next.js API) bypasses RLS automatically.
--
-- VERIFY: Section 5 must start with "DO $$" (not bare DROP POLICY on bookings).
-- If you see bookings error, re-copy this ENTIRE file from the repo (Ctrl+A).

-- ---------------------------------------------------------------------------
-- 1. LEADS
-- ---------------------------------------------------------------------------
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leads_agent_select ON public.leads;
DROP POLICY IF EXISTS leads_agent_insert ON public.leads;
DROP POLICY IF EXISTS leads_agent_update ON public.leads;
DROP POLICY IF EXISTS leads_agent_delete ON public.leads;

CREATE POLICY leads_agent_select ON public.leads
  FOR SELECT TO authenticated
  USING (
    agent_id = auth.uid()
    OR agent_id IS NULL
    OR public.is_deal_manager()
  );

CREATE POLICY leads_agent_insert ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (
    agent_id = auth.uid()
    OR agent_id IS NULL
    OR public.is_deal_manager()
  );

CREATE POLICY leads_agent_update ON public.leads
  FOR UPDATE TO authenticated
  USING (
    agent_id = auth.uid()
    OR agent_id IS NULL
    OR public.is_deal_manager()
  )
  WITH CHECK (
    agent_id = auth.uid()
    OR agent_id IS NULL
    OR public.is_deal_manager()
  );

CREATE POLICY leads_agent_delete ON public.leads
  FOR DELETE TO authenticated
  USING (public.is_deal_manager());

-- ---------------------------------------------------------------------------
-- 2. CALLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS calls_agent_select ON public.calls;
DROP POLICY IF EXISTS calls_agent_insert ON public.calls;
DROP POLICY IF EXISTS calls_agent_update ON public.calls;
DROP POLICY IF EXISTS calls_agent_delete ON public.calls;

CREATE POLICY calls_agent_select ON public.calls
  FOR SELECT TO authenticated
  USING (
    agent_id = auth.uid()
    OR agent_id IS NULL
    OR public.is_deal_manager()
  );

CREATE POLICY calls_agent_insert ON public.calls
  FOR INSERT TO authenticated
  WITH CHECK (
    agent_id = auth.uid()
    OR agent_id IS NULL
    OR public.is_deal_manager()
  );

CREATE POLICY calls_agent_update ON public.calls
  FOR UPDATE TO authenticated
  USING (public.is_deal_manager());

CREATE POLICY calls_agent_delete ON public.calls
  FOR DELETE TO authenticated
  USING (public.is_deal_manager());

-- ---------------------------------------------------------------------------
-- 3. PROPERTIES (shared read; agents edit own inventory)
-- ---------------------------------------------------------------------------
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS properties_agent_select ON public.properties;
DROP POLICY IF EXISTS properties_agent_insert ON public.properties;
DROP POLICY IF EXISTS properties_agent_update ON public.properties;
DROP POLICY IF EXISTS properties_agent_delete ON public.properties;

CREATE POLICY properties_agent_select ON public.properties
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY properties_agent_insert ON public.properties
  FOR INSERT TO authenticated
  WITH CHECK (agent_id = auth.uid() OR public.is_deal_manager());

CREATE POLICY properties_agent_update ON public.properties
  FOR UPDATE TO authenticated
  USING (agent_id = auth.uid() OR public.is_deal_manager());

CREATE POLICY properties_agent_delete ON public.properties
  FOR DELETE TO authenticated
  USING (agent_id = auth.uid() OR public.is_deal_manager());

-- ---------------------------------------------------------------------------
-- 4. LEAD TASKS (skip if migration 018 not applied yet)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'lead_tasks'
  ) THEN
    ALTER TABLE public.lead_tasks ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS lead_tasks_agent_select ON public.lead_tasks';
    EXECUTE 'DROP POLICY IF EXISTS lead_tasks_agent_insert ON public.lead_tasks';
    EXECUTE 'DROP POLICY IF EXISTS lead_tasks_agent_delete ON public.lead_tasks';
    EXECUTE $p$
      CREATE POLICY lead_tasks_agent_select ON public.lead_tasks
        FOR SELECT TO authenticated
        USING (
          agent_id = auth.uid()
          OR agent_id IS NULL
          OR public.is_deal_manager()
        )
    $p$;
    EXECUTE $p$
      CREATE POLICY lead_tasks_agent_insert ON public.lead_tasks
        FOR INSERT TO authenticated
        WITH CHECK (
          agent_id = auth.uid()
          OR agent_id IS NULL
          OR public.is_deal_manager()
        )
    $p$;
    EXECUTE $p$
      CREATE POLICY lead_tasks_agent_delete ON public.lead_tasks
        FOR DELETE TO authenticated
        USING (agent_id = auth.uid() OR public.is_deal_manager())
    $p$;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. BOOKINGS — skip if migration 002/007 not applied yet
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'bookings'
  ) THEN
    ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS "Agents select own bookings" ON public.bookings';
    EXECUTE $p$
      CREATE POLICY "Agents select own bookings"
        ON public.bookings FOR SELECT TO authenticated
        USING (
          agent_id = auth.uid()
          OR public.is_deal_manager()
          OR (
            agent_id IS NULL
            AND EXISTS (
              SELECT 1 FROM public.properties p
              WHERE p.id = bookings.property_id AND p.agent_id = auth.uid()
            )
          )
        )
    $p$;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 6. OUTBOUND CAMPAIGNS + CAMPAIGN LEADS (skip if migration 003 not applied)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'outbound_campaigns'
  ) THEN
    -- outbound_scoring.sql creates this table without agent_id; 003 adds it
    ALTER TABLE public.outbound_campaigns
      ADD COLUMN IF NOT EXISTS agent_id uuid;

    ALTER TABLE public.outbound_campaigns ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can view campaigns" ON public.outbound_campaigns';
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can insert campaigns" ON public.outbound_campaigns';
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can update campaigns" ON public.outbound_campaigns';
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can delete campaigns" ON public.outbound_campaigns';
    EXECUTE 'DROP POLICY IF EXISTS campaigns_agent_select ON public.outbound_campaigns';
    EXECUTE 'DROP POLICY IF EXISTS campaigns_manager_insert ON public.outbound_campaigns';
    EXECUTE 'DROP POLICY IF EXISTS campaigns_manager_update ON public.outbound_campaigns';
    EXECUTE 'DROP POLICY IF EXISTS campaigns_manager_delete ON public.outbound_campaigns';
    EXECUTE $p$
      CREATE POLICY campaigns_agent_select ON public.outbound_campaigns
        FOR SELECT TO authenticated
        USING (
          agent_id = auth.uid()
          OR agent_id IS NULL
          OR public.is_deal_manager()
        )
    $p$;
    EXECUTE $p$
      CREATE POLICY campaigns_manager_insert ON public.outbound_campaigns
        FOR INSERT TO authenticated
        WITH CHECK (public.is_deal_manager())
    $p$;
    EXECUTE $p$
      CREATE POLICY campaigns_manager_update ON public.outbound_campaigns
        FOR UPDATE TO authenticated
        USING (public.is_deal_manager())
    $p$;
    EXECUTE $p$
      CREATE POLICY campaigns_manager_delete ON public.outbound_campaigns
        FOR DELETE TO authenticated
        USING (public.is_deal_manager())
    $p$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'campaign_leads'
  ) THEN
    ALTER TABLE public.campaign_leads ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can view campaign_leads" ON public.campaign_leads';
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can insert campaign_leads" ON public.campaign_leads';
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can update campaign_leads" ON public.campaign_leads';
    EXECUTE 'DROP POLICY IF EXISTS campaign_leads_agent_select ON public.campaign_leads';
    EXECUTE 'DROP POLICY IF EXISTS campaign_leads_manager_insert ON public.campaign_leads';
    EXECUTE 'DROP POLICY IF EXISTS campaign_leads_manager_update ON public.campaign_leads';
    EXECUTE $p$
      CREATE POLICY campaign_leads_agent_select ON public.campaign_leads
        FOR SELECT TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.outbound_campaigns c
            WHERE c.id = campaign_leads.campaign_id
              AND (
                c.agent_id = auth.uid()
                OR c.agent_id IS NULL
                OR public.is_deal_manager()
              )
          )
        )
    $p$;
    EXECUTE $p$
      CREATE POLICY campaign_leads_manager_insert ON public.campaign_leads
        FOR INSERT TO authenticated
        WITH CHECK (public.is_deal_manager())
    $p$;
    EXECUTE $p$
      CREATE POLICY campaign_leads_manager_update ON public.campaign_leads
        FOR UPDATE TO authenticated
        USING (public.is_deal_manager())
    $p$;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 7. INTEGRATION SETTINGS — managers only (skip if table missing)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'integration_settings'
  ) THEN
    ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS "Users can view own integration settings" ON public.integration_settings';
    EXECUTE 'DROP POLICY IF EXISTS "Users can insert own integration settings" ON public.integration_settings';
    EXECUTE 'DROP POLICY IF EXISTS "Users can update own integration settings" ON public.integration_settings';
    EXECUTE 'DROP POLICY IF EXISTS integration_settings_manager_select ON public.integration_settings';
    EXECUTE 'DROP POLICY IF EXISTS integration_settings_manager_insert ON public.integration_settings';
    EXECUTE 'DROP POLICY IF EXISTS integration_settings_manager_update ON public.integration_settings';
    EXECUTE 'DROP POLICY IF EXISTS integration_settings_manager_delete ON public.integration_settings';
    EXECUTE $p$
      CREATE POLICY integration_settings_manager_select ON public.integration_settings
        FOR SELECT TO authenticated
        USING (public.is_deal_manager())
    $p$;
    EXECUTE $p$
      CREATE POLICY integration_settings_manager_insert ON public.integration_settings
        FOR INSERT TO authenticated
        WITH CHECK (public.is_deal_manager())
    $p$;
    EXECUTE $p$
      CREATE POLICY integration_settings_manager_update ON public.integration_settings
        FOR UPDATE TO authenticated
        USING (public.is_deal_manager())
    $p$;
    EXECUTE $p$
      CREATE POLICY integration_settings_manager_delete ON public.integration_settings
        FOR DELETE TO authenticated
        USING (public.is_deal_manager())
    $p$;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 8. CONSENT LOG — skip if migration 023 not applied yet
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'consent_log'
  ) THEN
    ALTER TABLE public.consent_log ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS "Agents can view consent logs" ON public.consent_log';
    EXECUTE 'DROP POLICY IF EXISTS "Allow consent log insert" ON public.consent_log';
    EXECUTE 'DROP POLICY IF EXISTS consent_log_manager_select ON public.consent_log';
    EXECUTE 'DROP POLICY IF EXISTS consent_log_insert ON public.consent_log';
    EXECUTE $p$
      CREATE POLICY consent_log_manager_select ON public.consent_log
        FOR SELECT TO authenticated
        USING (public.is_deal_manager())
    $p$;
    EXECUTE $p$
      CREATE POLICY consent_log_insert ON public.consent_log
        FOR INSERT
        WITH CHECK (true)
    $p$;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 9. OPEN HOUSE — skip if migration 016 not applied yet
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'open_house_attendees'
  ) THEN
    ALTER TABLE public.open_house_attendees ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS "open_house_attendees_insert" ON public.open_house_attendees';
    EXECUTE 'DROP POLICY IF EXISTS open_house_attendees_public_insert ON public.open_house_attendees';
    EXECUTE $p$
      CREATE POLICY open_house_attendees_public_insert ON public.open_house_attendees
        FOR INSERT
        WITH CHECK (true)
    $p$;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 10. AGENTS — managers list all; preserve signup self-insert
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS agents_manager_select ON public.agents;
CREATE POLICY agents_manager_select ON public.agents
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_deal_manager());

DROP POLICY IF EXISTS agents_manager_delete ON public.agents;
CREATE POLICY agents_manager_delete ON public.agents
  FOR DELETE TO authenticated
  USING (public.is_deal_manager());

-- ---------------------------------------------------------------------------
-- 11. WHATSAPP LEGACY LOG
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'whatsapp_messages'
  ) THEN
    ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS whatsapp_messages_manager_select ON public.whatsapp_messages';
    EXECUTE $p$
      CREATE POLICY whatsapp_messages_manager_select ON public.whatsapp_messages
        FOR SELECT TO authenticated
        USING (public.is_deal_manager())
    $p$;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 12. AGENT SETTINGS (if table exists)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'agent_settings'
  ) THEN
    ALTER TABLE public.agent_settings ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS agent_settings_select ON public.agent_settings';
    EXECUTE 'DROP POLICY IF EXISTS agent_settings_update ON public.agent_settings';
    EXECUTE 'DROP POLICY IF EXISTS agent_settings_insert ON public.agent_settings';
    EXECUTE $p$
      CREATE POLICY agent_settings_select ON public.agent_settings
        FOR SELECT TO authenticated
        USING (agent_id = auth.uid() OR public.is_deal_manager())
    $p$;
    EXECUTE $p$
      CREATE POLICY agent_settings_update ON public.agent_settings
        FOR UPDATE TO authenticated
        USING (agent_id = auth.uid())
    $p$;
    EXECUTE $p$
      CREATE POLICY agent_settings_insert ON public.agent_settings
        FOR INSERT TO authenticated
        WITH CHECK (agent_id = auth.uid())
    $p$;
  END IF;
END $$;
