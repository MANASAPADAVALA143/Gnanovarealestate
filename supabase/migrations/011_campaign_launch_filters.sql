-- Store builder filters + allow "running" campaign status label used by the dashboard
ALTER TABLE public.outbound_campaigns
  ADD COLUMN IF NOT EXISTS launch_filters jsonb DEFAULT '{}'::jsonb;
