-- Speed-to-Lead: log each portal intake + VAPI call outcome (n8n universal webhook)

CREATE TABLE IF NOT EXISTS public.speed_to_lead_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  source TEXT,
  property_interest TEXT,
  budget TEXT,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  call_triggered_at TIMESTAMPTZ,
  call_status TEXT DEFAULT 'pending',
  vapi_call_id TEXT,
  response_seconds INTEGER,
  call_duration_seconds INTEGER,
  lead_score INTEGER,
  score_label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stl_lead ON public.speed_to_lead_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_stl_source ON public.speed_to_lead_log(source);
CREATE INDEX IF NOT EXISTS idx_stl_vapi_call ON public.speed_to_lead_log(vapi_call_id);
