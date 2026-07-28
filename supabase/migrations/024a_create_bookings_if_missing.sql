-- Run this FIRST if 024 failed with: relation "public.bookings" does not exist
-- Creates the appointments table (migration 002). Safe to run if table already exists.

CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  scheduled_date date NOT NULL,
  scheduled_time time NOT NULL DEFAULT '12:00',
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Optional columns from 007 (ignore errors if already applied)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL;

ALTER TABLE public.bookings
  ALTER COLUMN lead_id DROP NOT NULL;
