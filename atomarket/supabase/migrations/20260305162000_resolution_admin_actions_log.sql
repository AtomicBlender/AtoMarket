do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'admin_action_type' and n.nspname = 'public'
  ) then
    create type public.admin_action_type as enum ('DEFER', 'RESOLVE', 'INVALIDATE');
  end if;
end $$;

create table if not exists public.resolution_admin_actions (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets(id) on delete cascade,
  admin_user_id uuid not null references public.profiles(id) on delete cascade,
  action_type public.admin_action_type not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_resolution_admin_actions_market_created
  on public.resolution_admin_actions (market_id, created_at desc);

alter table public.resolution_admin_actions enable row level security;

create policy "resolution_admin_actions_public_read"
on public.resolution_admin_actions
for select
using (true);

create policy "resolution_admin_actions_admin_insert"
on public.resolution_admin_actions
for insert to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin
  )
);
