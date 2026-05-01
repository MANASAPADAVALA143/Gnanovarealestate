-- RPC used by /api/vapi/outbound-webhook: bump connected count only.
-- calls_made / calls_completed / calls_failed are recalculated by update_campaign_stats()
-- when campaign_leads rows change (see 003_add_integrations_and_campaigns.sql).
CREATE OR REPLACE FUNCTION public.increment_campaign_calls(
  campaign_id UUID,
  was_connected BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.outbound_campaigns
  SET
    calls_connected = COALESCE(calls_connected, 0) + CASE WHEN was_connected THEN 1 ELSE 0 END,
    updated_at = NOW()
  WHERE id = campaign_id;
END;
$$;

-- Include terminal dial outcomes so progress (calls_made) does not drop when status becomes no-answer.
CREATE OR REPLACE FUNCTION public.update_campaign_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  cid UUID;
BEGIN
  cid := COALESCE(NEW.campaign_id, OLD.campaign_id);

  UPDATE public.outbound_campaigns
  SET
    calls_made = (
      SELECT COUNT(*)
      FROM public.campaign_leads
      WHERE campaign_id = cid
        AND status IN ('calling', 'completed', 'no-answer', 'failed')
    ),
    calls_completed = (
      SELECT COUNT(*)
      FROM public.campaign_leads
      WHERE campaign_id = cid
        AND status = 'completed'
    ),
    calls_failed = (
      SELECT COUNT(*)
      FROM public.campaign_leads
      WHERE campaign_id = cid
        AND status = 'failed'
    ),
    updated_at = NOW()
  WHERE id = cid;

  RETURN COALESCE(NEW, OLD);
END;
$$;
