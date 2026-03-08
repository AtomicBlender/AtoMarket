create or replace function public.effective_market_status(
  p_status public.market_status,
  p_close_time timestamptz
)
returns public.market_status
language sql
stable
set search_path = public
as $$
  select
    case
      when p_status in ('CLOSED', 'RESOLVING') then 'RESOLVING'::public.market_status
      when p_status = 'OPEN' and p_close_time <= now() then 'RESOLVING'::public.market_status
      else p_status
    end;
$$;

create or replace function public.market_trading_phase(
  p_status public.market_status,
  p_close_time timestamptz
)
returns text
language sql
stable
set search_path = public
as $$
  select
    case
      when public.effective_market_status(p_status, p_close_time) in ('RESOLVED', 'INVALID_REFUND') then 'TRADING_CLOSED'
      when p_close_time > now() then 'TRADING_OPEN'
      else 'TRADING_CLOSED'
    end;
$$;

drop function if exists public.get_markets_feed(text, text, text, text, integer, integer);

create or replace function public.get_markets_feed(
  p_lifecycle text default 'ALL',
  p_trading_phase text default 'ALL',
  p_category text default null,
  p_search text default null,
  p_limit integer default 24,
  p_offset integer default 0
)
returns table(
  id uuid,
  title text,
  question text,
  description text,
  category text,
  status public.market_status,
  close_time timestamptz,
  volume_neutrons bigint,
  b double precision,
  q_yes double precision,
  q_no double precision,
  created_at timestamptz,
  total_count bigint
)
language sql
security definer
set search_path = public
as $$
  with filtered as (
    select
      m.*,
      public.effective_market_status(m.status, m.close_time) as effective_status,
      public.market_trading_phase(m.status, m.close_time) as trading_phase
    from public.markets m
    where (
      coalesce(p_lifecycle, 'ALL') = 'ALL'
      or public.effective_market_status(m.status, m.close_time)::text = p_lifecycle
    )
      and (
        coalesce(p_trading_phase, 'ALL') = 'ALL'
        or public.market_trading_phase(m.status, m.close_time) = p_trading_phase
      )
      and (nullif(trim(p_category), '') is null or m.category = nullif(trim(p_category), ''))
      and (
        nullif(trim(p_search), '') is null
        or to_tsvector('simple', coalesce(m.title, '') || ' ' || coalesce(m.question, '') || ' ' || coalesce(m.description, ''))
          @@ plainto_tsquery('simple', trim(p_search))
      )
  )
  select
    f.id,
    f.title,
    f.question,
    f.description,
    f.category,
    f.effective_status as status,
    f.close_time,
    f.volume_neutrons,
    f.b,
    f.q_yes,
    f.q_no,
    f.created_at,
    count(*) over() as total_count
  from filtered f
  order by
    case
      when coalesce(p_lifecycle, 'ALL') = 'ALL' and coalesce(p_trading_phase, 'ALL') = 'ALL' and f.effective_status = 'OPEN' and f.trading_phase = 'TRADING_OPEN' then 0
      when coalesce(p_lifecycle, 'ALL') = 'ALL' and coalesce(p_trading_phase, 'ALL') = 'ALL' then 1
      else 0
    end,
    f.volume_neutrons desc,
    f.created_at desc
  limit greatest(1, p_limit)
  offset greatest(0, p_offset);
$$;

grant execute on function public.get_markets_feed(text, text, text, text, integer, integer) to anon, authenticated;

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
  markets_with_effective_status as (
    select
      m.*,
      public.effective_market_status(m.status, m.close_time) as effective_status
    from public.markets m
  ),
  market_rollup as (
    select
      count(*) as total_markets,
      count(*) filter (where m.effective_status = 'OPEN' and public.market_trading_phase(m.status, m.close_time) = 'TRADING_OPEN') as open_markets,
      count(*) filter (where m.effective_status = 'RESOLVING') as resolving_markets,
      count(*) filter (where m.effective_status = 'RESOLVED') as resolved_markets,
      count(*) filter (where m.effective_status = 'INVALID_REFUND') as invalid_markets,
      count(*) filter (
        where m.effective_status in ('OPEN', 'RESOLVING')
          and m.resolution_deadline >= now()
          and m.resolution_deadline <= now() + interval '24 hours'
      ) as markets_nearing_deadline,
      count(*) filter (
        where m.effective_status not in ('RESOLVED', 'INVALID_REFUND')
          and m.close_time < now()
      ) as overdue_unresolved_markets,
      coalesce(sum(m.volume_neutrons), 0) as total_volume_neutrons
    from markets_with_effective_status m
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
  p_lifecycle text default 'ALL',
  p_trading_phase text default 'ALL',
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
      public.effective_market_status(m.status, m.close_time) as effective_status,
      public.market_trading_phase(m.status, m.close_time) as trading_phase,
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
    where (
      coalesce(p_lifecycle, 'ALL') = 'ALL'
      or public.effective_market_status(m.status, m.close_time)::text = p_lifecycle
    )
      and (
        coalesce(p_trading_phase, 'ALL') = 'ALL'
        or public.market_trading_phase(m.status, m.close_time) = p_trading_phase
      )
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
          and public.effective_market_status(m.status, m.close_time) not in ('RESOLVED', 'INVALID_REFUND')
          and m.close_time < now()
        )
        or (
          p_attention = 'DEADLINE'
          and public.effective_market_status(m.status, m.close_time) not in ('RESOLVED', 'INVALID_REFUND')
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
    b.effective_status as status,
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
      when b.effective_status not in ('RESOLVED', 'INVALID_REFUND') and b.close_time < now() then 1
      when b.effective_status not in ('RESOLVED', 'INVALID_REFUND')
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
