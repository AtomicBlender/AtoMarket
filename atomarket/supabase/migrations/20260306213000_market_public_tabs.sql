create or replace function public.get_market_top_holders_public(
  p_market_id uuid,
  p_outcome public.outcome_type,
  p_limit integer default 25
)
returns table(
  user_id uuid,
  username text,
  display_name text,
  shares double precision
)
language sql
security definer
set search_path = public
as $$
  select
    p.id as user_id,
    p.username,
    p.display_name,
    case when p_outcome = 'YES' then pos.yes_shares else pos.no_shares end as shares
  from public.positions pos
  join public.profiles p on p.id = pos.user_id
  where pos.market_id = p_market_id
    and coalesce(p.is_active, true) = true
    and (case when p_outcome = 'YES' then pos.yes_shares else pos.no_shares end) > 0
  order by shares desc, coalesce(p.username, '') asc, p.id asc
  limit greatest(1, least(coalesce(p_limit, 25), 200));
$$;

create or replace function public.get_market_top_positions_public(
  p_market_id uuid,
  p_outcome public.outcome_type,
  p_limit integer default 25
)
returns table(
  user_id uuid,
  username text,
  display_name text,
  shares double precision,
  current_value_neutrons double precision,
  cost_basis_neutrons double precision,
  unrealized_pnl_neutrons double precision,
  unrealized_pnl_pct double precision
)
language sql
security definer
set search_path = public
as $$
  with market_snapshot as (
    select
      m.id,
      m.q_yes,
      m.q_no,
      m.b,
      exp(m.q_yes / m.b) / (exp(m.q_yes / m.b) + exp(m.q_no / m.b)) as yes_price
    from public.markets m
    where m.id = p_market_id
  ),
  base as (
    select
      p.id as user_id,
      p.username,
      p.display_name,
      case when p_outcome = 'YES' then pos.yes_shares else pos.no_shares end as shares,
      (pos.yes_shares + pos.no_shares) as total_shares,
      pos.net_spent_neutrons::double precision as net_spent_neutrons,
      case when p_outcome = 'YES' then ms.yes_price else (1 - ms.yes_price) end as current_price
    from public.positions pos
    join public.profiles p on p.id = pos.user_id
    join market_snapshot ms on ms.id = pos.market_id
    where pos.market_id = p_market_id
      and coalesce(p.is_active, true) = true
      and (case when p_outcome = 'YES' then pos.yes_shares else pos.no_shares end) > 0
  ),
  scored as (
    select
      b.user_id,
      b.username,
      b.display_name,
      b.shares,
      (b.shares * b.current_price) as current_value_neutrons,
      case
        when b.total_shares > 0 then b.net_spent_neutrons * (b.shares / b.total_shares)
        else 0
      end as cost_basis_neutrons
    from base b
  )
  select
    s.user_id,
    s.username,
    s.display_name,
    s.shares,
    s.current_value_neutrons,
    s.cost_basis_neutrons,
    (s.current_value_neutrons - s.cost_basis_neutrons) as unrealized_pnl_neutrons,
    case
      when s.cost_basis_neutrons > 0 then (s.current_value_neutrons - s.cost_basis_neutrons) / s.cost_basis_neutrons
      else null
    end as unrealized_pnl_pct
  from scored s
  order by s.current_value_neutrons desc, coalesce(s.username, '') asc, s.user_id asc
  limit greatest(1, least(coalesce(p_limit, 25), 200));
$$;

create or replace function public.get_market_trades_public(
  p_market_id uuid,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table(
  id uuid,
  market_id uuid,
  user_id uuid,
  username text,
  display_name text,
  outcome public.outcome_type,
  side public.trade_side,
  quantity double precision,
  cost_neutrons bigint,
  sell_proceeds_neutrons bigint,
  price_before double precision,
  price_after double precision,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    t.id,
    t.market_id,
    t.user_id,
    p.username,
    p.display_name,
    t.outcome,
    t.side,
    t.quantity,
    t.cost_neutrons,
    t.sell_proceeds_neutrons,
    t.price_before,
    t.price_after,
    t.created_at
  from public.trades t
  join public.profiles p on p.id = t.user_id
  where t.market_id = p_market_id
    and coalesce(p.is_active, true) = true
  order by t.created_at desc
  limit greatest(1, least(coalesce(p_limit, 25), 200))
  offset greatest(0, coalesce(p_offset, 0));
$$;

grant execute on function public.get_market_top_holders_public(uuid, public.outcome_type, integer) to anon, authenticated;
grant execute on function public.get_market_top_positions_public(uuid, public.outcome_type, integer) to anon, authenticated;
grant execute on function public.get_market_trades_public(uuid, integer, integer) to anon, authenticated;
