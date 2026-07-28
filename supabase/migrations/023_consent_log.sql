-- UAE PDPL consent audit log + lead consent columns

CREATE TABLE IF NOT EXISTS public.consent_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID,
  email         TEXT,
  phone         TEXT,
  context       TEXT NOT NULL CHECK (context IN ('lead', 'demo', 'openhouse')),
  consented_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address    TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consent_log_lead_id ON public.consent_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_consent_log_email ON public.consent_log(email);

ALTER TABLE public.consent_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agents can view consent logs" ON public.consent_log;
CREATE POLICY "Agents can view consent logs"
  ON public.consent_log FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow consent log insert" ON public.consent_log;
CREATE POLICY "Allow consent log insert"
  ON public.consent_log FOR INSERT
  WITH CHECK (true);

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS consent_given BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS consent_timestamp TIMESTAMPTZ;

COMMENT ON TABLE public.consent_log IS 'UAE PDPL audit log — retain for compliance; do not delete rows.';
