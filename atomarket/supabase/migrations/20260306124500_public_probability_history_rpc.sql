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
  select t.created_at, t.price_before, t.price_after
  from public.trades t
  where t.market_id = p_market_id
  order by t.created_at asc;
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
  select t.market_id, t.created_at, t.price_before, t.price_after
  from public.trades t
  where t.market_id = any(p_market_ids)
  order by t.market_id asc, t.created_at asc;
$$;

grant execute on function public.get_market_probability_history_public(uuid) to anon, authenticated;
grant execute on function public.get_market_probability_history_public_batch(uuid[]) to anon, authenticated;
