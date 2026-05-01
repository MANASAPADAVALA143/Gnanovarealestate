-- Call length from VAPI end-of-call-report (for "No Answer" when duration < 10s)

ALTER TABLE public.speed_to_lead_log
  ADD COLUMN IF NOT EXISTS call_duration_seconds INTEGER;
