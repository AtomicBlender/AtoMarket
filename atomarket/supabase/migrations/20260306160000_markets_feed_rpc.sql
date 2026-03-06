drop function if exists public.get_markets_feed(text, text, text, integer, integer);

create or replace function public.get_markets_feed(
  p_status text default 'ALL',
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
  resolution_deadline timestamptz,
  resolution_type public.resolution_type,
  resolution_source text,
  resolution_rule jsonb,
  challenge_window_hours integer,
  proposal_bond_neutrons bigint,
  challenge_bond_neutrons bigint,
  resolved_outcome public.outcome_type,
  resolution_notes text,
  resolved_at timestamptz,
  invalid_reason text,
  resolution_attempts integer,
  volume_neutrons bigint,
  b double precision,
  q_yes double precision,
  q_no double precision,
  created_by uuid,
  created_at timestamptz,
  total_count bigint
)
language sql
security definer
set search_path = public
as $$
  with filtered as (
    select m.*
    from public.markets m
    where (coalesce(p_status, 'ALL') = 'ALL' or m.status::text = p_status)
      and (nullif(trim(p_category), '') is null or m.category = nullif(trim(p_category), ''))
      and (
        nullif(trim(p_search), '') is null
        or m.title ilike ('%' || trim(p_search) || '%')
        or m.question ilike ('%' || trim(p_search) || '%')
        or coalesce(m.description, '') ilike ('%' || trim(p_search) || '%')
      )
  )
  select
    f.id,
    f.title,
    f.question,
    f.description,
    f.category,
    f.status,
    f.close_time,
    f.resolution_deadline,
    f.resolution_type,
    f.resolution_source,
    f.resolution_rule,
    f.challenge_window_hours,
    f.proposal_bond_neutrons,
    f.challenge_bond_neutrons,
    f.resolved_outcome,
    f.resolution_notes,
    f.resolved_at,
    f.invalid_reason,
    f.resolution_attempts,
    f.volume_neutrons,
    f.b,
    f.q_yes,
    f.q_no,
    f.created_by,
    f.created_at,
    count(*) over() as total_count
  from filtered f
  order by
    case
      when coalesce(p_status, 'ALL') = 'ALL' and f.status = 'OPEN' then 0
      when coalesce(p_status, 'ALL') = 'ALL' then 1
      else 0
    end,
    f.volume_neutrons desc,
    f.created_at desc
  limit greatest(1, p_limit)
  offset greatest(0, p_offset);
$$;

grant execute on function public.get_markets_feed(text, text, text, integer, integer) to anon, authenticated;
