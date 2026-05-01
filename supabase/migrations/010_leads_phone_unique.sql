-- Enables PostgREST upsert onConflict: 'phone' for bulk imports.
-- If this fails, remove duplicate phones in public.leads first, then re-run.

CREATE UNIQUE INDEX IF NOT EXISTS leads_phone_unique ON public.leads (phone);
