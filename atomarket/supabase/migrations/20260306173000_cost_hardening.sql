create index if not exists idx_trades_market_created_at
  on public.trades(market_id, created_at desc);

create index if not exists idx_trades_created_market_user
  on public.trades(created_at desc, market_id, user_id);

create index if not exists idx_resolution_proposals_status_deadline
  on public.resolution_proposals(status, challenge_deadline);

create index if not exists idx_markets_status_volume_created
  on public.markets(status, volume_neutrons desc, created_at desc);

create index if not exists idx_markets_search_fts
  on public.markets
  using gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(question, '') || ' ' || coalesce(description, '')));

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
    select m.*
    from public.markets m
    where (coalesce(p_status, 'ALL') = 'ALL' or m.status::text = p_status)
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
    f.status,
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

create or replace function public.get_market_probability_history_public(
  p_market_id uuid
)
returns table (
  created_at timestamptz,
  price_before double precision,
  price_after double precision
)
language sql
security definer
set search_path = public
as $$
  with recent as (
    select t.created_at, t.price_before, t.price_after
    from public.trades t
    where t.market_id = p_market_id
    order by t.created_at desc
    limit 1500
  )
  select r.created_at, r.price_before, r.price_after
  from recent r
  order by r.created_at asc;
$$;

create or replace function public.get_market_probability_history_public_batch(
  p_market_ids uuid[]
)
returns table (
  market_id uuid,
  created_at timestamptz,
  price_before double precision,
  price_after double precision
)
language sql
security definer
set search_path = public
as $$
  with ranked as (
    select
      t.market_id,
      t.created_at,
      t.price_before,
      t.price_after,
      row_number() over (partition by t.market_id order by t.created_at desc) as rn
    from public.trades t
    where t.market_id = any(p_market_ids)
  )
  select r.market_id, r.created_at, r.price_before, r.price_after
  from ranked r
  where r.rn <= 600
  order by r.market_id asc, r.created_at asc;
$$;

grant execute on function public.get_market_probability_history_public(uuid) to anon, authenticated;
grant execute on function public.get_market_probability_history_public_batch(uuid[]) to anon, authenticated;

drop function if exists public.get_public_portfolio_trades(text);

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
  limit 250;
$$;

grant execute on function public.get_public_portfolio_trades(text) to anon, authenticated;
