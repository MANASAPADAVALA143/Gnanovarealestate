create table if not exists public.whatsapp_bot_sessions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  phone text not null,
  step integer not null default 0,
  answer_1 text,
  answer_2 text,
  answer_3 text,
  score text check (score in ('Hot', 'Warm', 'Cold')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.whatsapp_bot_sessions enable row level security;

create policy "Authenticated users can read bot sessions"
  on public.whatsapp_bot_sessions for select using (auth.role() = 'authenticated');

create policy "Service role can manage bot sessions"
  on public.whatsapp_bot_sessions for all using (true);
