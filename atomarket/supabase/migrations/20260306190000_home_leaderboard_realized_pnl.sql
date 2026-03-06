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
  window_trades as (
    select t.*
    from public.trades t
    join eligible_profiles ep on ep.user_id = t.user_id
    where t.created_at >= now() - make_interval(days => greatest(1, p_window_days))
  ),
  pnl_metrics as (
    select
      wt.user_id,
      sum(wt.quantity)::double precision as shares_traded,
      coalesce(sum(
        case
          when wt.side = 'SELL' then coalesce(
            wt.realized_pnl_neutrons,
            coalesce(wt.sell_proceeds_neutrons, wt.cost_neutrons) - coalesce(wt.sell_cost_basis_neutrons, 0)
          )
          else 0
        end
      ), 0)::numeric as realized_pnl,
      coalesce(sum(
        case
          when wt.side = 'BUY' then wt.cost_neutrons
          when wt.side = 'SELL' then coalesce(wt.sell_cost_basis_neutrons, 0)
          else 0
        end
      ), 0)::numeric as total_cost,
      coalesce(sum(
        case
          when wt.side = 'SELL' then coalesce(wt.sell_proceeds_neutrons, wt.cost_neutrons)
          else 0
        end
      ), 0)::numeric as total_return
    from window_trades wt
    group by wt.user_id
  ),
  markets_snapshot as (
    select m.id, m.status, m.resolved_outcome
    from public.markets m
  ),
  outcome_rollups as (
    select
      wt.user_id,
      wt.market_id,
      wt.outcome,
      sum(case when wt.side = 'BUY' then wt.quantity else 0 end) as bought_shares,
      sum(case when wt.side = 'SELL' then wt.quantity else 0 end) as sold_shares,
      sum(case when wt.side = 'BUY' then wt.cost_neutrons else 0 end)::numeric as buy_cost,
      sum(case when wt.side = 'SELL' then coalesce(wt.sell_proceeds_neutrons, wt.cost_neutrons) else 0 end)::numeric as sell_proceeds
    from window_trades wt
    group by wt.user_id, wt.market_id, wt.outcome
  ),
  outcome_metrics as (
    select
      o.user_id,
      o.market_id,
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
  accuracy_metrics as (
    select
      om.user_id,
      count(distinct case when om.is_resolved_market then om.market_id else null end)::integer as resolved_markets_count,
      coalesce(sum(case when om.is_resolved_market then om.total_cost else 0 end), 0)::numeric as resolved_total_cost,
      coalesce(sum(case when om.is_resolved_market then om.total_return else 0 end), 0)::numeric as resolved_total_return
    from outcome_metrics om
    group by om.user_id
  )
  select
    ep.username,
    ep.display_name,
    round(pm.realized_pnl)::bigint as net_gain_neutrons,
    round(pm.total_cost)::bigint as total_cost_neutrons,
    round(pm.total_return)::bigint as total_return_neutrons,
    case
      when coalesce(am.resolved_total_cost, 0) > 0 then ((am.resolved_total_return - am.resolved_total_cost) / am.resolved_total_cost)::double precision
      else null
    end as accuracy_score,
    coalesce(am.resolved_markets_count, 0)::integer as resolved_markets_count,
    pm.shares_traded
  from pnl_metrics pm
  join eligible_profiles ep on ep.user_id = pm.user_id
  left join accuracy_metrics am on am.user_id = pm.user_id
  where pm.shares_traded >= 20
  order by
    pm.realized_pnl desc,
    coalesce(am.resolved_markets_count, 0) desc,
    pm.total_cost desc,
    ep.username asc
  limit greatest(1, p_limit);
$$;

grant execute on function public.get_home_leaderboard(integer, integer) to anon, authenticated;
