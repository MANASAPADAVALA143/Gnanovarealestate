-- Run this in Supabase if 024 failed on: column "agent_id" does not exist (outbound_campaigns)
-- Then re-run the full 024_rls_policies.sql from the repo (Ctrl+A copy).

ALTER TABLE public.outbound_campaigns
  ADD COLUMN IF NOT EXISTS agent_id uuid;

-- Optional: assign existing campaigns to your agent (replace email)
-- UPDATE public.outbound_campaigns oc
-- SET agent_id = a.id
-- FROM public.agents a
-- WHERE a.email = 'your@email.com' AND oc.agent_id IS NULL;
