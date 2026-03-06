drop function if exists public.get_home_leaderboard(integer, integer);

create or replace function public.get_home_leaderboard(
  p_window_days integer default 30,
  p_limit integer default 100
)
returns table(
  username text,
  display_name text,
  net_gain_neutrons bigint,
  total_cost_neutrons bigint,
  total_return_neutrons bigint,
  accuracy_score double precision,
  resolved_markets_count integer,
  shares_traded double precision
)
language sql
security definer
set search_path = public
as $$
  with eligible_profiles as (
    select p.id as user_id, p.username, p.display_name
    from public.profiles p
    where p.username is not null
      and coalesce(p.is_active, true) = true
  ),
  markets_snapshot as (
    select m.id, m.status, m.resolved_outcome
    from public.markets m
  ),
  outcome_rollups as (
    select
      t.user_id,
      t.market_id,
      t.outcome,
      sum(case when t.side = 'BUY' then t.quantity else 0 end) as bought_shares,
      sum(case when t.side = 'SELL' then t.quantity else 0 end) as sold_shares,
      sum(case when t.side = 'BUY' then t.cost_neutrons else 0 end)::numeric as buy_cost,
      sum(case when t.side = 'SELL' then coalesce(t.sell_proceeds_neutrons, t.cost_neutrons) else 0 end)::numeric as sell_proceeds,
      sum(t.quantity) as shares_traded
    from public.trades t
    join markets_snapshot ms on ms.id = t.market_id
    join eligible_profiles ep on ep.user_id = t.user_id
    where t.created_at >= now() - make_interval(days => greatest(1, p_window_days))
    group by t.user_id, t.market_id, t.outcome
  ),
  outcome_metrics as (
    select
      o.user_id,
      o.market_id,
      o.shares_traded,
      o.buy_cost as total_cost,
      (ms.status in ('RESOLVED', 'INVALID_REFUND')) as is_resolved_market,
      (
        o.sell_proceeds +
        case
          when ms.status = 'RESOLVED' and ms.resolved_outcome = o.outcome then floor(greatest(o.bought_shares - o.sold_shares, 0))
          when ms.status = 'INVALID_REFUND' then
            case
              when o.bought_shares > 0 then o.buy_cost * (greatest(o.bought_shares - o.sold_shares, 0) / o.bought_shares)
              else 0
            end
          else 0
        end
      ) as total_return
    from outcome_rollups o
    join markets_snapshot ms on ms.id = o.market_id
  ),
  user_metrics as (
    select
      om.user_id,
      count(distinct case when om.is_resolved_market then om.market_id else null end)::integer as resolved_markets_count,
      sum(om.shares_traded) as shares_traded,
      coalesce(sum(om.total_cost), 0)::numeric as total_cost,
      coalesce(sum(om.total_return), 0)::numeric as total_return,
      coalesce(sum(case when om.is_resolved_market then om.total_cost else 0 end), 0)::numeric as resolved_total_cost,
      coalesce(sum(case when om.is_resolved_market then om.total_return else 0 end), 0)::numeric as resolved_total_return
    from outcome_metrics om
    group by om.user_id
  )
  select
    ep.username,
    ep.display_name,
    round(um.total_return - um.total_cost)::bigint as net_gain_neutrons,
    round(um.total_cost)::bigint as total_cost_neutrons,
    round(um.total_return)::bigint as total_return_neutrons,
    case
      when um.resolved_total_cost > 0 then ((um.resolved_total_return - um.resolved_total_cost) / um.resolved_total_cost)::double precision
      else null
    end as accuracy_score,
    um.resolved_markets_count,
    um.shares_traded
  from user_metrics um
  join eligible_profiles ep on ep.user_id = um.user_id
  where um.shares_traded >= 20
  order by
    (um.total_return - um.total_cost) desc,
    um.resolved_markets_count desc,
    um.total_cost desc,
    ep.username asc
  limit greatest(1, p_limit);
$$;

grant execute on function public.get_home_leaderboard(integer, integer) to anon, authenticated;
