-- 029: Broker rank model (additive only — does not change agent-matcher / lead scoring / invoicing)
-- Columns store computed merit score + raw factor breakdown for audit / tuning.

ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS broker_rank_score NUMERIC(6, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rank_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rank_factors JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.agents.broker_rank_score IS
  'Merit rank 0–100. Computed by app (calculateBrokerRank) from deals/response/revenue/satisfaction. Not used by agent-matcher yet (Step B).';
COMMENT ON COLUMN public.agents.rank_factors IS
  'Raw inputs + component scores last used to compute broker_rank_score. Keys: deals_closed, avg_response_time_seconds, revenue_generated, client_satisfaction_score, active_lead_count, weights, components.';
COMMENT ON COLUMN public.agents.rank_updated_at IS
  'When broker_rank_score / rank_factors were last written.';

CREATE INDEX IF NOT EXISTS idx_agents_broker_rank_score
  ON public.agents (broker_rank_score DESC NULLS LAST);

-- Expose rank on the safe directory view used by Analytics leaderboard (no email/phone/billing).
CREATE OR REPLACE VIEW public.agents_directory AS
  SELECT
    id,
    full_name,
    is_available,
    broker_rank_score,
    rank_updated_at
  FROM public.agents;

GRANT SELECT ON public.agents_directory TO authenticated;

NOTIFY pgrst, 'reload schema';
