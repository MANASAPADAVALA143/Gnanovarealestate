-- Shared WhatsApp Inbox: conversation threads, thread messages, internal notes
-- Depends on: public.leads, public.agents (018_crm_layer, 019_deals_module)
--
-- NOTE: public.whatsapp_messages (018) is the legacy outbound/inbound log used by
-- whatsapp-inbound.ts and send-property. It is intentionally untouched here.
-- Inbox conversation rows live in public.whatsapp_thread_messages.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.whatsapp_thread_status AS ENUM (
    'unassigned',
    'bot_handling',
    'agent_handling',
    'closed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.whatsapp_message_direction AS ENUM (
    'inbound',
    'outbound'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.whatsapp_sender_type AS ENUM (
    'lead',
    'bot',
    'agent'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- whatsapp_threads
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.whatsapp_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  assigned_agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  status public.whatsapp_thread_status NOT NULL DEFAULT 'unassigned',
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  unread_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT whatsapp_threads_phone_not_empty_chk CHECK (trim(phone_number) <> ''),
  CONSTRAINT whatsapp_threads_unread_nonneg_chk CHECK (unread_count >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_threads_phone_unique
  ON public.whatsapp_threads (phone_number);

CREATE INDEX IF NOT EXISTS idx_whatsapp_threads_lead_id
  ON public.whatsapp_threads (lead_id)
  WHERE lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_threads_assigned_agent_id
  ON public.whatsapp_threads (assigned_agent_id)
  WHERE assigned_agent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_threads_status
  ON public.whatsapp_threads (status);

CREATE INDEX IF NOT EXISTS idx_whatsapp_threads_last_message_at
  ON public.whatsapp_threads (last_message_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_whatsapp_threads_inbox
  ON public.whatsapp_threads (assigned_agent_id, status, last_message_at DESC NULLS LAST);

COMMENT ON TABLE public.whatsapp_threads IS 'One conversation thread per lead WhatsApp number';
COMMENT ON COLUMN public.whatsapp_threads.phone_number IS 'Normalized E.164-style number (no whatsapp: prefix)';
COMMENT ON COLUMN public.whatsapp_threads.status IS 'unassigned | bot_handling | agent_handling | closed';

-- ---------------------------------------------------------------------------
-- whatsapp_thread_messages (inbox conversation log — distinct from 018 whatsapp_messages)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.whatsapp_thread_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.whatsapp_threads(id) ON DELETE CASCADE,
  direction public.whatsapp_message_direction NOT NULL,
  sender_type public.whatsapp_sender_type NOT NULL,
  sender_agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  body TEXT NOT NULL DEFAULT '',
  media_url TEXT,
  twilio_message_sid TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT whatsapp_thread_messages_agent_sender_chk CHECK (
    sender_type <> 'agent' OR sender_agent_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_thread_messages_thread_created
  ON public.whatsapp_thread_messages (thread_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_thread_messages_twilio_sid
  ON public.whatsapp_thread_messages (twilio_message_sid)
  WHERE twilio_message_sid IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_thread_messages_twilio_sid_unique
  ON public.whatsapp_thread_messages (twilio_message_sid)
  WHERE twilio_message_sid IS NOT NULL;

COMMENT ON TABLE public.whatsapp_thread_messages IS 'Thread-scoped WhatsApp messages for the shared inbox UI';

-- ---------------------------------------------------------------------------
-- whatsapp_internal_notes (agent-to-agent only; never sent to lead)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.whatsapp_internal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.whatsapp_threads(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  note_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT whatsapp_internal_notes_not_empty_chk CHECK (trim(note_text) <> '')
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_internal_notes_thread
  ON public.whatsapp_internal_notes (thread_id, created_at ASC);

-- ---------------------------------------------------------------------------
-- Triggers (inbox tables only — does not touch 018 whatsapp_messages trigger)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.whatsapp_threads_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_whatsapp_threads_set_updated_at ON public.whatsapp_threads;
CREATE TRIGGER trg_whatsapp_threads_set_updated_at
  BEFORE UPDATE ON public.whatsapp_threads
  FOR EACH ROW
  EXECUTE FUNCTION public.whatsapp_threads_set_updated_at();

-- Keep thread list metadata in sync when a conversation message is inserted
CREATE OR REPLACE FUNCTION public.whatsapp_thread_on_message_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_preview TEXT;
BEGIN
  v_preview := left(trim(COALESCE(NEW.body, '')), 200);
  IF v_preview = '' AND NEW.media_url IS NOT NULL THEN
    v_preview := '[media]';
  END IF;

  UPDATE public.whatsapp_threads t
  SET
    last_message_at = NEW.created_at,
    last_message_preview = NULLIF(v_preview, ''),
    unread_count = CASE
      WHEN NEW.direction = 'inbound' AND NEW.sender_type = 'lead'
        THEN t.unread_count + 1
      ELSE t.unread_count
    END,
    updated_at = NOW()
  WHERE t.id = NEW.thread_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_whatsapp_thread_on_message_insert ON public.whatsapp_thread_messages;
CREATE TRIGGER trg_whatsapp_thread_on_message_insert
  AFTER INSERT ON public.whatsapp_thread_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.whatsapp_thread_on_message_insert();

-- ---------------------------------------------------------------------------
-- RLS (same agent/manager pattern as deals — reuses is_deal_manager from 019)
-- ---------------------------------------------------------------------------

ALTER TABLE public.whatsapp_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_thread_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_internal_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_threads_agent_select ON public.whatsapp_threads;
CREATE POLICY whatsapp_threads_agent_select ON public.whatsapp_threads
  FOR SELECT TO authenticated
  USING (
    assigned_agent_id = auth.uid()
    OR assigned_agent_id IS NULL
    OR public.is_deal_manager()
  );

DROP POLICY IF EXISTS whatsapp_threads_agent_insert ON public.whatsapp_threads;
CREATE POLICY whatsapp_threads_agent_insert ON public.whatsapp_threads
  FOR INSERT TO authenticated
  WITH CHECK (
    assigned_agent_id = auth.uid()
    OR assigned_agent_id IS NULL
    OR public.is_deal_manager()
  );

DROP POLICY IF EXISTS whatsapp_threads_agent_update ON public.whatsapp_threads;
CREATE POLICY whatsapp_threads_agent_update ON public.whatsapp_threads
  FOR UPDATE TO authenticated
  USING (
    assigned_agent_id = auth.uid()
    OR assigned_agent_id IS NULL
    OR public.is_deal_manager()
  )
  WITH CHECK (
    assigned_agent_id = auth.uid()
    OR assigned_agent_id IS NULL
    OR public.is_deal_manager()
  );

DROP POLICY IF EXISTS whatsapp_thread_messages_agent_select ON public.whatsapp_thread_messages;
CREATE POLICY whatsapp_thread_messages_agent_select ON public.whatsapp_thread_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.whatsapp_threads t
      WHERE t.id = whatsapp_thread_messages.thread_id
        AND (
          t.assigned_agent_id = auth.uid()
          OR t.assigned_agent_id IS NULL
          OR public.is_deal_manager()
        )
    )
  );

DROP POLICY IF EXISTS whatsapp_thread_messages_agent_insert ON public.whatsapp_thread_messages;
CREATE POLICY whatsapp_thread_messages_agent_insert ON public.whatsapp_thread_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.whatsapp_threads t
      WHERE t.id = whatsapp_thread_messages.thread_id
        AND (
          t.assigned_agent_id = auth.uid()
          OR t.assigned_agent_id IS NULL
          OR public.is_deal_manager()
        )
    )
  );

DROP POLICY IF EXISTS whatsapp_internal_notes_agent_select ON public.whatsapp_internal_notes;
CREATE POLICY whatsapp_internal_notes_agent_select ON public.whatsapp_internal_notes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.whatsapp_threads t
      WHERE t.id = whatsapp_internal_notes.thread_id
        AND (
          t.assigned_agent_id = auth.uid()
          OR t.assigned_agent_id IS NULL
          OR public.is_deal_manager()
        )
    )
  );

DROP POLICY IF EXISTS whatsapp_internal_notes_agent_insert ON public.whatsapp_internal_notes;
CREATE POLICY whatsapp_internal_notes_agent_insert ON public.whatsapp_internal_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    agent_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.whatsapp_threads t
      WHERE t.id = whatsapp_internal_notes.thread_id
        AND (
          t.assigned_agent_id = auth.uid()
          OR t.assigned_agent_id IS NULL
          OR public.is_deal_manager()
        )
    )
  );
