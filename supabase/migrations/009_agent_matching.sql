-- Agent coverage, workload caps, and matching helpers

ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS zip_codes TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS specialty_tags TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS max_leads INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT TRUE;

CREATE OR REPLACE VIEW public.agent_workload AS
SELECT
  a.id,
  a.full_name,
  a.email,
  a.phone,
  a.zip_codes,
  a.specialty_tags,
  a.max_leads,
  a.is_available,
  COUNT(l.id) FILTER (
    WHERE l.status IS NULL
      OR lower(l.status) NOT IN ('closed', 'lost', 'disqualified')
  )::bigint AS active_lead_count
FROM public.agents a
LEFT JOIN public.leads l ON l.agent_id = a.id
GROUP BY
  a.id,
  a.full_name,
  a.email,
  a.phone,
  a.zip_codes,
  a.specialty_tags,
  a.max_leads,
  a.is_available;

CREATE TABLE IF NOT EXISTS public.agent_round_robin (
  id INTEGER PRIMARY KEY DEFAULT 1,
  last_index INTEGER NOT NULL DEFAULT 0
);

INSERT INTO public.agent_round_robin (id, last_index)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;
