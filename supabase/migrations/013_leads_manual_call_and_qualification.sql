-- Hot Leads view: manual follow-up tracking + Claude qualification fields
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS manual_call_done BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS manual_called_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS budget_mentioned TEXT,
  ADD COLUMN IF NOT EXISTS follow_up_action TEXT,
  ADD COLUMN IF NOT EXISTS interested_in TEXT;
