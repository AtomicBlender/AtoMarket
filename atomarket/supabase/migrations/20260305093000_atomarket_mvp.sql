-- AtoMarket MVP schema using neutron terminology.
create extension if not exists pgcrypto;

create type public.market_status as enum ('OPEN', 'CLOSED', 'RESOLVING', 'RESOLVED', 'INVALID_REFUND');
create type public.resolution_type as enum ('URL_SELECTOR', 'JSON_PATH', 'MANUAL_WITH_BOND');
create type public.outcome_type as enum ('YES', 'NO');
create type public.trade_side as enum ('BUY', 'SELL');
create type public.proposal_status as enum ('ACTIVE', 'CHALLENGED', 'FINALIZED', 'REJECTED');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  is_admin boolean not null default false,
  neutron_balance bigint not null default 10000,
  created_at timestamptz not null default now()
);

create table if not exists public.markets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  question text not null,
  category text,
  status public.market_status not null default 'OPEN',
  close_time timestamptz not null,
  resolution_deadline timestamptz not null,
  resolution_type public.resolution_type not null,
  resolution_source text not null,
  resolution_url text,
  resolution_rule jsonb not null,
  challenge_window_hours int not null default 48,
  proposal_bond_neutrons bigint not null default 500,
  challenge_bond_neutrons bigint not null default 500,
  resolved_outcome public.outcome_type,
  resolution_notes text,
  resolved_at timestamptz,
  invalid_reason text,
  resolution_attempts int not null default 0,
  b double precision not null default 500,
  q_yes double precision not null default 0,
  q_no double precision not null default 0,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (close_time < resolution_deadline),
  check (b > 0)
);

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  outcome public.outcome_type not null,
  side public.trade_side not null,
  quantity double precision not null,
  cost_neutrons bigint not null,
  price_before double precision not null,
  price_after double precision not null,
  created_at timestamptz not null default now(),
  check (quantity > 0),
  check (cost_neutrons >= 0)
);

create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  yes_shares double precision not null default 0,
  no_shares double precision not null default 0,
  net_spent_neutrons bigint not null default 0,
  realized_pnl_neutrons bigint not null default 0,
  updated_at timestamptz not null default now(),
  unique (market_id, user_id)
);

create table if not exists public.resolution_proposals (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets(id) on delete cascade,
  proposed_by uuid not null references public.profiles(id) on delete cascade,
  proposed_outcome public.outcome_type not null,
  evidence_url text,
  evidence_note text,
  bond_neutrons bigint not null,
  status public.proposal_status not null default 'ACTIVE',
  challenge_deadline timestamptz not null,
  created_at timestamptz not null default now(),
  check (bond_neutrons > 0)
);

create table if not exists public.resolution_challenges (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.resolution_proposals(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete cascade,
  challenged_by uuid not null references public.profiles(id) on delete cascade,
  challenge_outcome public.outcome_type not null,
  evidence_url text,
  evidence_note text,
  bond_neutrons bigint not null,
  created_at timestamptz not null default now(),
  check (bond_neutrons > 0)
);

create index if not exists idx_markets_status_close on public.markets(status, close_time);
create index if not exists idx_markets_category on public.markets(category);
create index if not exists idx_trades_user_market on public.trades(user_id, market_id);
create index if not exists idx_positions_user on public.positions(user_id);
create index if not exists idx_resolution_proposals_market on public.resolution_proposals(market_id);
create index if not exists idx_resolution_challenges_market on public.resolution_challenges(market_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.current_yes_price(p_q_yes double precision, p_q_no double precision, p_b double precision)
returns double precision
language sql
immutable
as $$
  select exp(p_q_yes / p_b) / (exp(p_q_yes / p_b) + exp(p_q_no / p_b));
$$;

create or replace function public.lmsr_cost(p_q_yes double precision, p_q_no double precision, p_b double precision)
returns double precision
language sql
immutable
as $$
  select p_b * ln(exp(p_q_yes / p_b) + exp(p_q_no / p_b));
$$;

create or replace function public.place_trade_buy_only(
  p_market_id uuid,
  p_outcome public.outcome_type,
  p_quantity double precision
)
returns table(
  trade_id uuid,
  market_id uuid,
  user_id uuid,
  spent_neutrons bigint,
  price_before double precision,
  price_after double precision,
  new_balance bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_market public.markets%rowtype;
  v_position public.positions%rowtype;
  v_q_yes_after double precision;
  v_q_no_after double precision;
  v_cost_before double precision;
  v_cost_after double precision;
  v_delta_cost bigint;
  v_price_before double precision;
  v_price_after double precision;
  v_trade_id uuid := gen_random_uuid();
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  if p_quantity <= 0 then
    raise exception 'invalid_quantity';
  end if;

  select * into v_profile from public.profiles where id = v_user for update;
  if not found then
    raise exception 'profile_not_found';
  end if;

  select * into v_market from public.markets where id = p_market_id for update;
  if not found then
    raise exception 'market_not_found';
  end if;

  if v_market.status <> 'OPEN' or now() >= v_market.close_time then
    raise exception 'market_closed';
  end if;

  v_price_before := public.current_yes_price(v_market.q_yes, v_market.q_no, v_market.b);

  if p_outcome = 'YES' then
    v_q_yes_after := v_market.q_yes + p_quantity;
    v_q_no_after := v_market.q_no;
  else
    v_q_yes_after := v_market.q_yes;
    v_q_no_after := v_market.q_no + p_quantity;
  end if;

  v_cost_before := public.lmsr_cost(v_market.q_yes, v_market.q_no, v_market.b);
  v_cost_after := public.lmsr_cost(v_q_yes_after, v_q_no_after, v_market.b);
  v_delta_cost := ceil(v_cost_after - v_cost_before);

  if v_delta_cost <= 0 then
    raise exception 'invalid_trade_cost';
  end if;

  if v_profile.neutron_balance < v_delta_cost then
    raise exception 'insufficient_neutrons';
  end if;

  insert into public.positions (market_id, user_id)
  values (v_market.id, v_user)
  on conflict (market_id, user_id) do nothing;

  select * into v_position
  from public.positions
  where market_id = v_market.id and user_id = v_user
  for update;

  update public.markets
  set q_yes = v_q_yes_after,
      q_no = v_q_no_after
  where id = v_market.id;

  update public.profiles
  set neutron_balance = neutron_balance - v_delta_cost
  where id = v_user;

  if p_outcome = 'YES' then
    update public.positions
    set yes_shares = yes_shares + p_quantity,
        net_spent_neutrons = net_spent_neutrons + v_delta_cost,
        updated_at = now()
    where id = v_position.id;
  else
    update public.positions
    set no_shares = no_shares + p_quantity,
        net_spent_neutrons = net_spent_neutrons + v_delta_cost,
        updated_at = now()
    where id = v_position.id;
  end if;

  v_price_after := public.current_yes_price(v_q_yes_after, v_q_no_after, v_market.b);

  insert into public.trades (
    id,
    market_id,
    user_id,
    outcome,
    side,
    quantity,
    cost_neutrons,
    price_before,
    price_after
  )
  values (
    v_trade_id,
    v_market.id,
    v_user,
    p_outcome,
    'BUY',
    p_quantity,
    v_delta_cost,
    v_price_before,
    v_price_after
  );

  return query
  select
    v_trade_id,
    v_market.id,
    v_user,
    v_delta_cost,
    v_price_before,
    v_price_after,
    (v_profile.neutron_balance - v_delta_cost);
end;
$$;

create or replace function public.finalize_market_yes_no(
  p_market_id uuid,
  p_outcome public.outcome_type,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_market public.markets%rowtype;
  v_position record;
  v_payout bigint;
  v_user uuid := auth.uid();
  v_is_admin boolean := false;
begin
  select is_admin into v_is_admin from public.profiles where id = v_user;
  if coalesce(v_is_admin, false) = false then
    raise exception 'admin_required';
  end if;

  select * into v_market from public.markets where id = p_market_id for update;
  if not found then
    raise exception 'market_not_found';
  end if;

  if v_market.status in ('RESOLVED', 'INVALID_REFUND') then
    return;
  end if;

  for v_position in
    select * from public.positions where market_id = p_market_id and (yes_shares > 0 or no_shares > 0)
  loop
    if p_outcome = 'YES' then
      v_payout := floor(v_position.yes_shares);
    else
      v_payout := floor(v_position.no_shares);
    end if;

    update public.profiles
    set neutron_balance = neutron_balance + v_payout
    where id = v_position.user_id;

    update public.positions
    set realized_pnl_neutrons = v_payout - net_spent_neutrons,
        yes_shares = 0,
        no_shares = 0,
        net_spent_neutrons = 0,
        updated_at = now()
    where id = v_position.id;
  end loop;

  update public.markets
  set status = 'RESOLVED',
      resolved_outcome = p_outcome,
      resolution_notes = p_notes,
      resolved_at = now()
  where id = p_market_id;
end;
$$;

create or replace function public.finalize_market_invalid_refund(
  p_market_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_market public.markets%rowtype;
  v_position record;
  v_user uuid := auth.uid();
  v_is_admin boolean := false;
begin
  select is_admin into v_is_admin from public.profiles where id = v_user;
  if coalesce(v_is_admin, false) = false then
    raise exception 'admin_required';
  end if;

  select * into v_market from public.markets where id = p_market_id for update;
  if not found then
    raise exception 'market_not_found';
  end if;

  if v_market.status in ('RESOLVED', 'INVALID_REFUND') then
    return;
  end if;

  for v_position in
    select * from public.positions where market_id = p_market_id and net_spent_neutrons > 0
  loop
    update public.profiles
    set neutron_balance = neutron_balance + v_position.net_spent_neutrons
    where id = v_position.user_id;

    update public.positions
    set realized_pnl_neutrons = 0,
        yes_shares = 0,
        no_shares = 0,
        net_spent_neutrons = 0,
        updated_at = now()
    where id = v_position.id;
  end loop;

  update public.markets
  set status = 'INVALID_REFUND',
      invalid_reason = p_reason,
      resolved_at = now()
  where id = p_market_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.markets enable row level security;
alter table public.trades enable row level security;
alter table public.positions enable row level security;
alter table public.resolution_proposals enable row level security;
alter table public.resolution_challenges enable row level security;

-- Profiles
create policy "profiles_read_own" on public.profiles
for select to authenticated
using (id = auth.uid());

create policy "profiles_update_own" on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Markets
create policy "markets_public_read" on public.markets
for select to anon, authenticated
using (true);

create policy "markets_create_auth" on public.markets
for insert to authenticated
with check (created_by = auth.uid());

create policy "markets_admin_update" on public.markets
for update to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- Trades
create policy "trades_read_own" on public.trades
for select to authenticated
using (user_id = auth.uid());

-- Positions
create policy "positions_read_own" on public.positions
for select to authenticated
using (user_id = auth.uid());

-- Resolution proposals/challenges read by all authenticated and anonymous.
create policy "proposals_public_read" on public.resolution_proposals
for select to anon, authenticated
using (true);

create policy "challenges_public_read" on public.resolution_challenges
for select to anon, authenticated
using (true);

create policy "proposals_insert_auth" on public.resolution_proposals
for insert to authenticated
with check (proposed_by = auth.uid());

create policy "challenges_insert_auth" on public.resolution_challenges
for insert to authenticated
with check (challenged_by = auth.uid());

create policy "proposals_admin_update" on public.resolution_proposals
for update to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "challenges_admin_update" on public.resolution_challenges
for update to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

grant execute on function public.place_trade_buy_only(uuid, public.outcome_type, double precision) to authenticated;
grant execute on function public.finalize_market_yes_no(uuid, public.outcome_type, text) to authenticated;
grant execute on function public.finalize_market_invalid_refund(uuid, text) to authenticated;
