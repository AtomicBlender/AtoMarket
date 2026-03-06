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
  resolved_market_signals as (
    select
      wt.user_id,
      wt.market_id,
      sum(case when wt.outcome = 'YES' then case when wt.side = 'BUY' then wt.quantity else -wt.quantity end else 0 end) as net_yes_shares,
      sum(case when wt.outcome = 'NO' then case when wt.side = 'BUY' then wt.quantity else -wt.quantity end else 0 end) as net_no_shares
    from window_trades wt
    join markets_snapshot ms on ms.id = wt.market_id
    where ms.status in ('RESOLVED', 'INVALID_REFUND')
    group by wt.user_id, wt.market_id
  ),
  market_hits as (
    select
      rms.user_id,
      rms.market_id,
      case
        when ms.status = 'INVALID_REFUND' then null
        when rms.net_yes_shares = rms.net_no_shares then null
        when ms.resolved_outcome = 'YES' and rms.net_yes_shares > rms.net_no_shares then 1
        when ms.resolved_outcome = 'NO' and rms.net_no_shares > rms.net_yes_shares then 1
        else 0
      end as hit
    from resolved_market_signals rms
    join markets_snapshot ms on ms.id = rms.market_id
  ),
  accuracy_metrics as (
    select
      mh.user_id,
      count(*) filter (where mh.hit is not null)::integer as resolved_markets_count,
      avg(mh.hit::double precision) filter (where mh.hit is not null) as hit_rate
    from market_hits mh
    group by mh.user_id
  )
  select
    ep.username,
    ep.display_name,
    round(pm.realized_pnl)::bigint as net_gain_neutrons,
    round(pm.total_cost)::bigint as total_cost_neutrons,
    round(pm.total_return)::bigint as total_return_neutrons,
    am.hit_rate as accuracy_score,
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
