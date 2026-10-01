create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_phone text,
  suite_id uuid references public.suites(id) on delete set null,
  suite_number text,
  total_price numeric not null default 0,
  booking_amount numeric not null default 0,
  installment_number integer not null default 1,
  installment_amount numeric not null default 0,
  due_date date not null,
  paid_date timestamptz,
  payment_method text,
  utr_number text,
  status text not null default 'Pending'
    check (status in ('Pending', 'Paid', 'Overdue')),
  receipt_sent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payments enable row level security;

create policy "Authenticated users can read payments"
  on public.payments for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert payments"
  on public.payments for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update payments"
  on public.payments for update using (auth.role() = 'authenticated');
