-- Open house scheduling + attendee check-ins + follow-up tracking

CREATE TABLE IF NOT EXISTS public.open_house_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  address TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.open_house_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  open_house_id UUID NOT NULL REFERENCES public.open_house_events(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  follow_up_status TEXT NOT NULL DEFAULT 'pending',
  call_triggered_at TIMESTAMPTZ,
  CONSTRAINT open_house_attendees_phone_unique UNIQUE (open_house_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_oh_attendees_followup
  ON public.open_house_attendees (open_house_id, follow_up_status)
  WHERE follow_up_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_open_house_events_agent ON public.open_house_events (agent_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_open_house_events_ends ON public.open_house_events (ends_at);

ALTER TABLE public.open_house_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.open_house_attendees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "open_house_events_select_own" ON public.open_house_events;
DROP POLICY IF EXISTS "open_house_events_insert_own" ON public.open_house_events;
DROP POLICY IF EXISTS "open_house_events_update_own" ON public.open_house_events;
DROP POLICY IF EXISTS "open_house_events_delete_own" ON public.open_house_events;

CREATE POLICY "open_house_events_select_own"
  ON public.open_house_events FOR SELECT TO authenticated
  USING (agent_id = auth.uid());

CREATE POLICY "open_house_events_insert_own"
  ON public.open_house_events FOR INSERT TO authenticated
  WITH CHECK (agent_id = auth.uid());

CREATE POLICY "open_house_events_update_own"
  ON public.open_house_events FOR UPDATE TO authenticated
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

CREATE POLICY "open_house_events_delete_own"
  ON public.open_house_events FOR DELETE TO authenticated
  USING (agent_id = auth.uid());

DROP POLICY IF EXISTS "open_house_attendees_select" ON public.open_house_attendees;
DROP POLICY IF EXISTS "open_house_attendees_insert" ON public.open_house_attendees;
DROP POLICY IF EXISTS "open_house_attendees_update" ON public.open_house_attendees;

CREATE POLICY "open_house_attendees_select"
  ON public.open_house_attendees FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.open_house_events e
      WHERE e.id = open_house_attendees.open_house_id AND e.agent_id = auth.uid()
    )
  );

CREATE POLICY "open_house_attendees_insert"
  ON public.open_house_attendees FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.open_house_events e
      WHERE e.id = open_house_attendees.open_house_id AND e.agent_id = auth.uid()
    )
  );

CREATE POLICY "open_house_attendees_update"
  ON public.open_house_attendees FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.open_house_events e
      WHERE e.id = open_house_attendees.open_house_id AND e.agent_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.open_house_events e
      WHERE e.id = open_house_attendees.open_house_id AND e.agent_id = auth.uid()
    )
  );
