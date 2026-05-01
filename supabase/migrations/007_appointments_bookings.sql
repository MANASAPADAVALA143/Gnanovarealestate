-- Appointments: extend bookings for dashboard, Cal.com, no-show recovery, call-based leads

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'showing';

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cal_com_uid text;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS call_id uuid REFERENCES public.calls(id) ON DELETE SET NULL;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS lead_display_name text;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS lead_display_phone text;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS no_show_follow_up_at timestamptz;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Allow showings booked from call log without a leads row
ALTER TABLE public.bookings ALTER COLUMN lead_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_agent_id ON public.bookings (agent_id);
CREATE INDEX IF NOT EXISTS idx_bookings_scheduled ON public.bookings (scheduled_date, scheduled_time);
CREATE INDEX IF NOT EXISTS idx_bookings_call_id ON public.bookings (call_id) WHERE call_id IS NOT NULL;

-- Audit trail before outbound AI/SMS (dashboard-triggered actions)
CREATE TABLE IF NOT EXISTS public.ai_action_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_action_audit_agent ON public.ai_action_audit (agent_id, created_at DESC);

ALTER TABLE public.ai_action_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents read own ai_action_audit"
  ON public.ai_action_audit FOR SELECT
  TO authenticated
  USING (agent_id = auth.uid());

CREATE POLICY "Agents insert own ai_action_audit"
  ON public.ai_action_audit FOR INSERT
  TO authenticated
  WITH CHECK (agent_id = auth.uid());

-- Bookings RLS: own agent or legacy rows tied to agent properties
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agents select own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Agents insert own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Agents update own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Agents delete own bookings" ON public.bookings;

CREATE POLICY "Agents select own bookings"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (
    agent_id = auth.uid()
    OR (
      agent_id IS NULL
      AND EXISTS (
        SELECT 1 FROM public.properties p
        WHERE p.id = bookings.property_id AND p.agent_id = auth.uid()
      )
    )
  );

CREATE POLICY "Agents insert own bookings"
  ON public.bookings FOR INSERT
  TO authenticated
  WITH CHECK (
    agent_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = bookings.property_id AND p.agent_id = auth.uid()
    )
  );

CREATE POLICY "Agents update own bookings"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (
    agent_id = auth.uid()
    OR (
      agent_id IS NULL
      AND EXISTS (
        SELECT 1 FROM public.properties p
        WHERE p.id = bookings.property_id AND p.agent_id = auth.uid()
      )
    )
  )
  WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents delete own bookings"
  ON public.bookings FOR DELETE
  TO authenticated
  USING (
    agent_id = auth.uid()
    OR (
      agent_id IS NULL
      AND EXISTS (
        SELECT 1 FROM public.properties p
        WHERE p.id = bookings.property_id AND p.agent_id = auth.uid()
      )
    )
  );
