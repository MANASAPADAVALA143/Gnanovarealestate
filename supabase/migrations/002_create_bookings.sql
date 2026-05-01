-- Bookings table for scheduled property viewings
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  scheduled_date date not null,
  scheduled_time time not null,
  status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now()
);

