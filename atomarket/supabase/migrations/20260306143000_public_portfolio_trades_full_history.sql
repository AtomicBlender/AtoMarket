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
  order by t.created_at desc;
$$;

grant execute on function public.get_public_portfolio_trades(text) to anon, authenticated;
