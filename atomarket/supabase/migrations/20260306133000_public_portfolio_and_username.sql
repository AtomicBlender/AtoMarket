alter table public.profiles
  add column if not exists username text;

alter table public.profiles
  drop constraint if exists profiles_username_format;

alter table public.profiles
  add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9_]{3,24}$');

create unique index if not exists idx_profiles_username_unique_ci
  on public.profiles (lower(username))
  where username is not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text := lower(nullif(trim(new.raw_user_meta_data->>'username'), ''));
begin
  insert into public.profiles (id, display_name, username)
  values (
    new.id,
    new.email,
    case when v_username ~ '^[a-z0-9_]{3,24}$' then v_username else null end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.is_username_available(
  p_username text
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.profiles p
    where lower(p.username) = lower(trim(p_username))
  );
$$;

create or replace function public.get_public_profile_by_username(
  p_username text
)
returns table(
  user_id uuid,
  username text,
  display_name text
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.username, p.display_name
  from public.profiles p
  where lower(p.username) = lower(trim(p_username))
    and coalesce(p.is_active, true) = true
  limit 1;
$$;

create or replace function public.get_public_portfolio_positions(
  p_username text
)
returns table(
  id uuid,
  market_id uuid,
  user_id uuid,
  yes_shares double precision,
  no_shares double precision,
  net_spent_neutrons bigint,
  realized_pnl_neutrons bigint,
  updated_at timestamptz,
  market_title text,
  market_status public.market_status,
  market_resolved_outcome public.outcome_type,
  market_q_yes double precision,
  market_q_no double precision,
  market_b double precision
)
language sql
security definer
set search_path = public
as $$
  with target as (
    select p.id
    from public.profiles p
    where lower(p.username) = lower(trim(p_username))
      and coalesce(p.is_active, true) = true
    limit 1
  )
  select
    pos.id,
    pos.market_id,
    pos.user_id,
    pos.yes_shares,
    pos.no_shares,
    pos.net_spent_neutrons,
    pos.realized_pnl_neutrons,
    pos.updated_at,
    m.title as market_title,
    m.status as market_status,
    m.resolved_outcome as market_resolved_outcome,
    m.q_yes as market_q_yes,
    m.q_no as market_q_no,
    m.b as market_b
  from public.positions pos
  join target t on t.id = pos.user_id
  join public.markets m on m.id = pos.market_id
  order by pos.updated_at desc;
$$;

create or replace function public.get_public_portfolio_trades(
  p_username text
)
returns table(
  id uuid,
  market_id uuid,
  user_id uuid,
  outcome public.outcome_type,
  side public.trade_side,
  quantity double precision,
  cost_neutrons bigint,
  sell_proceeds_neutrons bigint,
  sell_cost_basis_neutrons bigint,
  realized_pnl_neutrons bigint,
  price_before double precision,
  price_after double precision,
  created_at timestamptz,
  market_title text,
  market_status public.market_status,
  market_resolved_outcome public.outcome_type
)
language sql
security definer
set search_path = public
as $$
  with target as (
    select p.id
    from public.profiles p
    where lower(p.username) = lower(trim(p_username))
      and coalesce(p.is_active, true) = true
    limit 1
  )
  select
    t.id,
    t.market_id,
    t.user_id,
    t.outcome,
    t.side,
    t.quantity,
    t.cost_neutrons,
    t.sell_proceeds_neutrons,
    t.sell_cost_basis_neutrons,
    t.realized_pnl_neutrons,
    t.price_before,
    t.price_after,
    t.created_at,
    m.title as market_title,
    m.status as market_status,
    m.resolved_outcome as market_resolved_outcome
  from public.trades t
  join target x on x.id = t.user_id
  join public.markets m on m.id = t.market_id
  order by t.created_at desc
  limit 100;
$$;

grant execute on function public.is_username_available(text) to anon, authenticated;
grant execute on function public.get_public_profile_by_username(text) to anon, authenticated;
grant execute on function public.get_public_portfolio_positions(text) to anon, authenticated;
grant execute on function public.get_public_portfolio_trades(text) to anon, authenticated;
