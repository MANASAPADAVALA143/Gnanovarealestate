-- 032: Post-call follow-up email tracking
-- Additive only — does not alter VAPI scoring / call recording.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS follow_up_email_sent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS follow_up_email_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.leads.follow_up_email_sent IS
  'True after a successful post-call follow-up email was sent to this lead.';
COMMENT ON COLUMN public.leads.follow_up_email_sent_at IS
  'When the last successful post-call follow-up email was sent.';

-- Agent preference (default ON when null / missing row)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'agent_settings'
  ) THEN
    ALTER TABLE public.agent_settings
      ADD COLUMN IF NOT EXISTS notify_post_call_email BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  email_type text NOT NULL DEFAULT 'post_call_followup',
  recipient_email text,
  subject text,
  status text NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'failed', 'skipped_no_email', 'skipped_disabled', 'skipped_already_sent')),
  error_text text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_lead_id ON public.email_logs (lead_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON public.email_logs (sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON public.email_logs (status);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Authenticated: read own / shared-pool / manager (service_role inserts bypass RLS)
DROP POLICY IF EXISTS email_logs_select ON public.email_logs;
CREATE POLICY email_logs_select ON public.email_logs
  FOR SELECT TO authenticated
  USING (
    public.is_deal_manager()
    OR lead_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.leads l
      WHERE l.id = email_logs.lead_id
        AND (
          l.agent_id = auth.uid()
          OR l.agent_id IS NULL
        )
    )
  );

-- No INSERT/UPDATE/DELETE for authenticated → service_role only writes

NOTIFY pgrst, 'reload schema';
