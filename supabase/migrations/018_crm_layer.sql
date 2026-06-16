-- CRM layer: pipeline stages, activity timeline, tasks, consent log

-- Pipeline stage enum
DO $$ BEGIN
  CREATE TYPE public.pipeline_stage AS ENUM (
    'new',
    'contacted',
    'qualified',
    'viewing_scheduled',
    'viewing_done',
    'negotiation',
    'booked',
    'closed',
    'lost'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS pipeline_stage public.pipeline_stage DEFAULT 'new';

CREATE INDEX IF NOT EXISTS idx_leads_pipeline_stage ON public.leads(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_leads_agent_pipeline ON public.leads(agent_id, pipeline_stage);

-- Activity type enum
DO $$ BEGIN
  CREATE TYPE public.lead_activity_type AS ENUM (
    'call',
    'whatsapp',
    'email',
    'note',
    'stage_change',
    'viewing',
    'task'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  type public.lead_activity_type NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.agents(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_lead_activities_lead ON public.lead_activities(lead_id, created_at DESC);

-- Task type / status enums
DO $$ BEGIN
  CREATE TYPE public.lead_task_type AS ENUM (
    'follow_up_24h',
    'follow_up_48h',
    'viewing_reminder',
    'custom'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.lead_task_status AS ENUM (
    'pending',
    'completed',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.lead_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  due_at TIMESTAMPTZ NOT NULL,
  type public.lead_task_type NOT NULL DEFAULT 'custom',
  status public.lead_task_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_tasks_agent_due ON public.lead_tasks(agent_id, due_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_lead_tasks_lead ON public.lead_tasks(lead_id);

-- Consent log
CREATE TABLE IF NOT EXISTS public.lead_consent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  channel TEXT NOT NULL,
  consent_text TEXT NOT NULL DEFAULT '',
  opted_in BOOLEAN NOT NULL DEFAULT TRUE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT
);

CREATE INDEX IF NOT EXISTS idx_lead_consent_lead ON public.lead_consent(lead_id, timestamp DESC);

-- WhatsApp message log (used by send-property route + activity trigger)
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  lead_name TEXT,
  property_ids TEXT[],
  twilio_sid TEXT,
  status TEXT,
  provider TEXT DEFAULT 'twilio',
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_phone ON public.whatsapp_messages(phone, created_at DESC);

-- Resolve lead_id from phone for triggers
CREATE OR REPLACE FUNCTION public.crm_resolve_lead_id(p_lead_id UUID, p_phone TEXT)
RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  resolved UUID;
BEGIN
  IF p_lead_id IS NOT NULL THEN
    RETURN p_lead_id;
  END IF;
  IF p_phone IS NULL OR trim(p_phone) = '' THEN
    RETURN NULL;
  END IF;
  SELECT id INTO resolved FROM public.leads WHERE phone = p_phone LIMIT 1;
  RETURN resolved;
END;
$$;

-- Auto-log call activities
CREATE OR REPLACE FUNCTION public.crm_log_call_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_id UUID;
  v_content TEXT;
BEGIN
  v_lead_id := public.crm_resolve_lead_id(NEW.lead_id, NEW.lead_phone);
  IF v_lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_content := COALESCE(
    NULLIF(trim(NEW.ai_summary), ''),
    NULLIF(trim(NEW.transcript), ''),
    'Call logged'
  );

  INSERT INTO public.lead_activities (lead_id, type, content, created_at)
  VALUES (v_lead_id, 'call', left(v_content, 2000), COALESCE(NEW.created_at, NOW()));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_call_activity ON public.calls;
CREATE TRIGGER trg_crm_call_activity
  AFTER INSERT ON public.calls
  FOR EACH ROW
  EXECUTE FUNCTION public.crm_log_call_activity();

-- Auto-log WhatsApp activities
CREATE OR REPLACE FUNCTION public.crm_log_whatsapp_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_id UUID;
BEGIN
  v_lead_id := public.crm_resolve_lead_id(NULL, NEW.phone);
  IF v_lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.lead_activities (lead_id, type, content, created_at)
  VALUES (
    v_lead_id,
    'whatsapp',
    'WhatsApp message sent' || CASE WHEN NEW.lead_name IS NOT NULL THEN ' to ' || NEW.lead_name ELSE '' END,
    COALESCE(NEW.created_at, NOW())
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_whatsapp_activity ON public.whatsapp_messages;
CREATE TRIGGER trg_crm_whatsapp_activity
  AFTER INSERT ON public.whatsapp_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.crm_log_whatsapp_activity();

-- Auto-log pipeline stage changes
CREATE OR REPLACE FUNCTION public.crm_log_stage_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.pipeline_stage IS DISTINCT FROM OLD.pipeline_stage THEN
    INSERT INTO public.lead_activities (lead_id, type, content, created_at)
    VALUES (
      NEW.id,
      'stage_change',
      'Stage changed from ' || COALESCE(OLD.pipeline_stage::text, 'none') || ' to ' || NEW.pipeline_stage::text,
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_stage_change ON public.leads;
CREATE TRIGGER trg_crm_stage_change
  AFTER UPDATE OF pipeline_stage ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.crm_log_stage_change();

-- RLS (permissive for authenticated agents; service role bypasses)
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_consent ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_activities_agent_select ON public.lead_activities;
CREATE POLICY lead_activities_agent_select ON public.lead_activities
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_activities.lead_id
        AND (l.agent_id = auth.uid() OR l.agent_id IS NULL)
    )
  );

DROP POLICY IF EXISTS lead_activities_agent_insert ON public.lead_activities;
CREATE POLICY lead_activities_agent_insert ON public.lead_activities
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_activities.lead_id
        AND (l.agent_id = auth.uid() OR l.agent_id IS NULL)
    )
  );

DROP POLICY IF EXISTS lead_tasks_agent_select ON public.lead_tasks;
CREATE POLICY lead_tasks_agent_select ON public.lead_tasks
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS lead_tasks_agent_update ON public.lead_tasks;
CREATE POLICY lead_tasks_agent_update ON public.lead_tasks
  FOR UPDATE TO authenticated
  USING (agent_id = auth.uid() OR agent_id IS NULL);

DROP POLICY IF EXISTS lead_consent_agent_select ON public.lead_consent;
CREATE POLICY lead_consent_agent_select ON public.lead_consent
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_consent.lead_id
        AND (l.agent_id = auth.uid() OR l.agent_id IS NULL)
    )
  );
