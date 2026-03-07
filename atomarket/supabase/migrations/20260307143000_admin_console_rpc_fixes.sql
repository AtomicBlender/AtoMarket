create or replace function public.admin_get_overview()
returns table(
  total_users bigint,
  active_users_7d bigint,
  active_users_30d bigint,
  total_markets bigint,
  open_markets bigint,
  resolving_markets bigint,
  resolved_markets bigint,
  invalid_markets bigint,
  open_disputes bigint,
  markets_nearing_deadline bigint,
  overdue_unresolved_markets bigint,
  total_volume_neutrons bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_is_admin boolean := false;
begin
  select p.is_admin into v_is_admin from public.profiles p where p.id = v_user;
  if coalesce(v_is_admin, false) = false then
    raise exception 'admin_required';
  end if;

  return query
  with activity as (
    select
      count(distinct case when t.created_at >= now() - interval '7 days' then t.user_id end) as active_7d,
      count(distinct case when t.created_at >= now() - interval '30 days' then t.user_id end) as active_30d
    from public.trades t
  ),
  market_rollup as (
    select
      count(*) as total_markets,
      count(*) filter (where m.status = 'OPEN') as open_markets,
      count(*) filter (where m.status = 'RESOLVING') as resolving_markets,
      count(*) filter (where m.status = 'RESOLVED') as resolved_markets,
      count(*) filter (where m.status = 'INVALID_REFUND') as invalid_markets,
      count(*) filter (
        where m.status in ('OPEN', 'CLOSED', 'RESOLVING')
          and m.resolution_deadline >= now()
          and m.resolution_deadline <= now() + interval '24 hours'
      ) as markets_nearing_deadline,
      count(*) filter (
        where m.status not in ('RESOLVED', 'INVALID_REFUND')
          and m.close_time < now()
      ) as overdue_unresolved_markets,
      coalesce(sum(m.volume_neutrons), 0) as total_volume_neutrons
    from public.markets m
  ),
  dispute_rollup as (
    select count(*) as open_disputes
    from public.resolution_proposals rp
    where rp.status = 'CHALLENGED'
  )
  select
    (select count(*)::bigint from public.profiles) as total_users,
    coalesce(a.active_7d, 0)::bigint,
    coalesce(a.active_30d, 0)::bigint,
    mr.total_markets::bigint,
    mr.open_markets::bigint,
    mr.resolving_markets::bigint,
    mr.resolved_markets::bigint,
    mr.invalid_markets::bigint,
    dr.open_disputes::bigint,
    mr.markets_nearing_deadline::bigint,
    mr.overdue_unresolved_markets::bigint,
    coalesce(mr.total_volume_neutrons, 0)::bigint
  from activity a
  cross join market_rollup mr
  cross join dispute_rollup dr;
end;
$$;

create or replace function public.admin_get_markets(
  p_status text default 'ALL',
  p_attention text default 'ALL',
  p_category text default null,
  p_search text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table(
  id uuid,
  title text,
  category text,
  status public.market_status,
  created_at timestamptz,
  close_time timestamptz,
  resolution_deadline timestamptz,
  volume_neutrons bigint,
  resolution_attempts integer,
  creator_username text,
  creator_display_name text,
  has_active_proposal boolean,
  has_challenge boolean,
  proposal_status public.proposal_status,
  challenge_kind public.challenge_kind,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_is_admin boolean := false;
begin
  select p.is_admin into v_is_admin from public.profiles p where p.id = v_user;
  if coalesce(v_is_admin, false) = false then
    raise exception 'admin_required';
  end if;

  return query
  with proposal_state as (
    select distinct on (rp.market_id)
      rp.market_id,
      rp.status as proposal_status,
      (rp.status in ('ACTIVE', 'CHALLENGED')) as has_active_proposal,
      (rp.status = 'CHALLENGED') as has_challenge,
      rc.challenge_kind
    from public.resolution_proposals rp
    left join public.resolution_challenges rc on rc.proposal_id = rp.id
    order by rp.market_id, rp.created_at desc, rc.created_at desc nulls last
  ),
  base as (
    select
      m.id,
      m.title,
      m.category,
      m.status,
      m.created_at,
      m.close_time,
      m.resolution_deadline,
      m.volume_neutrons,
      m.resolution_attempts,
      p.username as creator_username,
      p.display_name as creator_display_name,
      coalesce(ps.has_active_proposal, false) as has_active_proposal,
      coalesce(ps.has_challenge, false) as has_challenge,
      ps.proposal_status,
      ps.challenge_kind
    from public.markets m
    left join public.profiles p on p.id = m.created_by
    left join proposal_state ps on ps.market_id = m.id
    where (coalesce(p_status, 'ALL') = 'ALL' or m.status::text = p_status)
      and (nullif(trim(p_category), '') is null or m.category = nullif(trim(p_category), ''))
      and (
        nullif(trim(p_search), '') is null
        or m.title ilike ('%' || trim(p_search) || '%')
        or coalesce(m.category, '') ilike ('%' || trim(p_search) || '%')
        or coalesce(p.username, '') ilike ('%' || trim(p_search) || '%')
        or coalesce(p.display_name, '') ilike ('%' || trim(p_search) || '%')
      )
      and (
        coalesce(p_attention, 'ALL') = 'ALL'
        or (p_attention = 'CHALLENGED' and coalesce(ps.has_challenge, false))
        or (
          p_attention = 'OVERDUE'
          and m.status not in ('RESOLVED', 'INVALID_REFUND')
          and m.close_time < now()
        )
        or (
          p_attention = 'DEADLINE'
          and m.status not in ('RESOLVED', 'INVALID_REFUND')
          and m.resolution_deadline >= now()
          and m.resolution_deadline <= now() + interval '24 hours'
        )
        or (
          p_attention = 'ACTIVE_PROPOSAL'
          and coalesce(ps.has_active_proposal, false)
        )
      )
  )
  select
    b.id,
    b.title,
    b.category,
    b.status,
    b.created_at,
    b.close_time,
    b.resolution_deadline,
    b.volume_neutrons,
    b.resolution_attempts,
    b.creator_username,
    b.creator_display_name,
    b.has_active_proposal,
    b.has_challenge,
    b.proposal_status,
    b.challenge_kind,
    count(*) over()::bigint as total_count
  from base b
  order by
    case
      when b.has_challenge then 0
      when b.status not in ('RESOLVED', 'INVALID_REFUND') and b.close_time < now() then 1
      when b.status not in ('RESOLVED', 'INVALID_REFUND')
        and b.resolution_deadline >= now()
        and b.resolution_deadline <= now() + interval '24 hours' then 2
      when b.has_active_proposal then 3
      else 4
    end,
    b.volume_neutrons desc,
    b.created_at desc
  limit greatest(1, p_limit)
  offset greatest(0, p_offset);
end;
$$;

create or replace function public.admin_get_users(
  p_search text default null,
  p_role text default 'ALL',
  p_state text default 'ALL',
  p_activity text default 'ALL',
  p_limit integer default 25,
  p_offset integer default 0
)
returns table(
  user_id uuid,
  username text,
  display_name text,
  is_active boolean,
  is_admin boolean,
  created_at timestamptz,
  neutron_balance bigint,
  trades_count bigint,
  created_markets_count bigint,
  open_positions_count bigint,
  last_trade_at timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_is_admin boolean := false;
begin
  select p.is_admin into v_is_admin from public.profiles p where p.id = v_user;
  if coalesce(v_is_admin, false) = false then
    raise exception 'admin_required';
  end if;

  return query
  with trade_rollup as (
    select
      t.user_id,
      count(*) as trades_count,
      max(t.created_at) as last_trade_at
    from public.trades t
    group by t.user_id
  ),
  market_rollup as (
    select
      m.created_by as user_id,
      count(*) as created_markets_count
    from public.markets m
    group by m.created_by
  ),
  position_rollup as (
    select
      pos.user_id,
      count(*) filter (
        where (coalesce(pos.yes_shares, 0) > 0 or coalesce(pos.no_shares, 0) > 0)
          and m.status in ('OPEN', 'CLOSED', 'RESOLVING')
      ) as open_positions_count
    from public.positions pos
    join public.markets m on m.id = pos.market_id
    group by pos.user_id
  ),
  base as (
    select
      p.id as user_id,
      p.username,
      p.display_name,
      coalesce(p.is_active, true) as is_active,
      p.is_admin,
      p.created_at,
      p.neutron_balance,
      coalesce(tr.trades_count, 0) as trades_count,
      coalesce(mr.created_markets_count, 0) as created_markets_count,
      coalesce(pr.open_positions_count, 0) as open_positions_count,
      tr.last_trade_at
    from public.profiles p
    left join trade_rollup tr on tr.user_id = p.id
    left join market_rollup mr on mr.user_id = p.id
    left join position_rollup pr on pr.user_id = p.id
    where (
      nullif(trim(p_search), '') is null
      or coalesce(p.username, '') ilike ('%' || trim(p_search) || '%')
      or coalesce(p.display_name, '') ilike ('%' || trim(p_search) || '%')
      or p.id::text ilike ('%' || trim(p_search) || '%')
    )
      and (
        coalesce(p_role, 'ALL') = 'ALL'
        or (p_role = 'ADMIN' and p.is_admin)
        or (p_role = 'NON_ADMIN' and not p.is_admin)
      )
      and (
        coalesce(p_state, 'ALL') = 'ALL'
        or (p_state = 'ACTIVE' and coalesce(p.is_active, true))
        or (p_state = 'INACTIVE' and not coalesce(p.is_active, true))
      )
      and (
        coalesce(p_activity, 'ALL') = 'ALL'
        or (p_activity = 'RECENT_7D' and tr.last_trade_at >= now() - interval '7 days')
        or (p_activity = 'RECENT_30D' and tr.last_trade_at >= now() - interval '30 days')
        or (p_activity = 'NO_TRADES' and tr.last_trade_at is null)
      )
  )
  select
    b.user_id,
    b.username,
    b.display_name,
    b.is_active,
    b.is_admin,
    b.created_at,
    b.neutron_balance::bigint,
    b.trades_count::bigint,
    b.created_markets_count::bigint,
    b.open_positions_count::bigint,
    b.last_trade_at,
    count(*) over()::bigint as total_count
  from base b
  order by
    b.is_admin desc,
    coalesce(b.last_trade_at, b.created_at) desc,
    b.created_at desc
  limit greatest(1, p_limit)
  offset greatest(0, p_offset);
end;
$$;
