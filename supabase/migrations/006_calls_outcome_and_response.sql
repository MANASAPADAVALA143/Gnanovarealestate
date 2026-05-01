-- Calls page: explicit outcome + optional speed-to-lead (set by ingestion/webhooks later)
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS call_outcome text;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS response_time_seconds integer;

COMMENT ON COLUMN public.calls.call_outcome IS 'qualified | not_reached | voicemail | callback (optional; may be derived in UI when null)';

CREATE INDEX IF NOT EXISTS idx_calls_agent_created ON public.calls (agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_call_outcome ON public.calls (call_outcome) WHERE call_outcome IS NOT NULL;
