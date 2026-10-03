create table if not exists public.suites (
  id uuid primary key default gen_random_uuid(),
  suite_number text not null,
  floor integer not null default 1,
  size_sqft numeric not null default 0,
  status text not null default 'Available'
    check (status in ('Available', 'Booked', 'Blocked', 'Sold')),
  price numeric not null default 0,
  customer_id uuid references public.leads(id) on delete set null,
  customer_name text,
  booking_date date,
  payment_received numeric not null default 0,
  balance_amount numeric not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS: agents can see all suites in their org
alter table public.suites enable row level security;

create policy "Authenticated users can read suites"
  on public.suites for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert suites"
  on public.suites for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update suites"
  on public.suites for update
  using (auth.role() = 'authenticated');
