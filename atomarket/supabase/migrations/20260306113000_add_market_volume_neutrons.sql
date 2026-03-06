alter table public.markets
  add column if not exists volume_neutrons bigint not null default 0;

update public.markets m
set volume_neutrons = coalesce(v.total_volume, 0)
from (
  select
    market_id,
    coalesce(sum(cost_neutrons), 0)::bigint as total_volume
  from public.trades
  group by market_id
) v
where m.id = v.market_id;

update public.markets
set volume_neutrons = 0
where volume_neutrons is null;

create or replace function public.place_trade_buy_only(
  p_market_id uuid,
  p_outcome public.outcome_type,
  p_quantity double precision
)
returns table(
  trade_id uuid,
  market_id uuid,
  user_id uuid,
  spent_neutrons bigint,
  price_before double precision,
  price_after double precision,
  new_balance bigint
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_market public.markets%rowtype;
  v_position public.positions%rowtype;
  v_q_yes_after double precision;
  v_q_no_after double precision;
  v_cost_before double precision;
  v_cost_after double precision;
  v_delta_cost bigint;
  v_price_before double precision;
  v_price_after double precision;
  v_trade_id uuid := gen_random_uuid();
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  if p_quantity <= 0 then
    raise exception 'invalid_quantity';
  end if;

  select * into v_profile from public.profiles p where p.id = v_user for update;
  if not found then
    raise exception 'profile_not_found';
  end if;

  select * into v_market from public.markets m where m.id = p_market_id for update;
  if not found then
    raise exception 'market_not_found';
  end if;

  if v_market.status <> 'OPEN' or now() >= v_market.close_time then
    raise exception 'market_closed';
  end if;

  v_price_before := public.current_yes_price(v_market.q_yes, v_market.q_no, v_market.b);

  if p_outcome = 'YES' then
    v_q_yes_after := v_market.q_yes + p_quantity;
    v_q_no_after := v_market.q_no;
  else
    v_q_yes_after := v_market.q_yes;
    v_q_no_after := v_market.q_no + p_quantity;
  end if;

  v_cost_before := public.lmsr_cost(v_market.q_yes, v_market.q_no, v_market.b);
  v_cost_after := public.lmsr_cost(v_q_yes_after, v_q_no_after, v_market.b);
  v_delta_cost := ceil(v_cost_after - v_cost_before);

  if v_delta_cost <= 0 then
    raise exception 'invalid_trade_cost';
  end if;

  if v_profile.neutron_balance < v_delta_cost then
    raise exception 'insufficient_neutrons';
  end if;

  insert into public.positions (market_id, user_id)
  values (v_market.id, v_user)
  on conflict (market_id, user_id) do nothing;

  select * into v_position
  from public.positions pos
  where pos.market_id = v_market.id and pos.user_id = v_user
  for update;

  update public.markets m
  set q_yes = v_q_yes_after,
      q_no = v_q_no_after,
      volume_neutrons = volume_neutrons + v_delta_cost
  where m.id = v_market.id;

  update public.profiles p
  set neutron_balance = neutron_balance - v_delta_cost
  where p.id = v_user;

  if p_outcome = 'YES' then
    update public.positions pos
    set yes_shares = yes_shares + p_quantity,
        net_spent_neutrons = net_spent_neutrons + v_delta_cost,
        updated_at = now()
    where pos.id = v_position.id;
  else
    update public.positions pos
    set no_shares = no_shares + p_quantity,
        net_spent_neutrons = net_spent_neutrons + v_delta_cost,
        updated_at = now()
    where pos.id = v_position.id;
  end if;

  v_price_after := public.current_yes_price(v_q_yes_after, v_q_no_after, v_market.b);

  insert into public.trades (
    id,
    market_id,
    user_id,
    outcome,
    side,
    quantity,
    cost_neutrons,
    price_before,
    price_after
  )
  values (
    v_trade_id,
    v_market.id,
    v_user,
    p_outcome,
    'BUY',
    p_quantity,
    v_delta_cost,
    v_price_before,
    v_price_after
  );

  return query
  select
    v_trade_id as trade_id,
    v_market.id as market_id,
    v_user as user_id,
    v_delta_cost as spent_neutrons,
    v_price_before as price_before,
    v_price_after as price_after,
    (v_profile.neutron_balance - v_delta_cost) as new_balance;
end;
$$;

create or replace function public.place_trade_sell_only(
  p_market_id uuid,
  p_outcome public.outcome_type,
  p_quantity double precision
)
returns table(
  trade_id uuid,
  market_id uuid,
  user_id uuid,
  credited_neutrons bigint,
  price_before double precision,
  price_after double precision,
  new_balance bigint
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_market public.markets%rowtype;
  v_position public.positions%rowtype;
  v_q_yes_after double precision;
  v_q_no_after double precision;
  v_cost_before double precision;
  v_cost_after double precision;
  v_credit bigint;
  v_price_before double precision;
  v_price_after double precision;
  v_trade_id uuid := gen_random_uuid();
  v_total_shares_before double precision;
  v_total_shares_after double precision;
  v_sold_cost_basis bigint;
  v_realized_pnl bigint;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  if p_quantity <= 0 then
    raise exception 'invalid_quantity';
  end if;

  select * into v_profile from public.profiles p where p.id = v_user for update;
  if not found then
    raise exception 'profile_not_found';
  end if;

  select * into v_market from public.markets m where m.id = p_market_id for update;
  if not found then
    raise exception 'market_not_found';
  end if;

  if v_market.status <> 'OPEN' or now() >= v_market.close_time then
    raise exception 'market_closed';
  end if;

  select * into v_position
  from public.positions pos
  where pos.market_id = v_market.id and pos.user_id = v_user
  for update;

  if not found then
    raise exception 'insufficient_shares';
  end if;

  if p_outcome = 'YES' then
    if v_position.yes_shares < p_quantity then
      raise exception 'insufficient_shares';
    end if;
    v_q_yes_after := v_market.q_yes - p_quantity;
    v_q_no_after := v_market.q_no;
  else
    if v_position.no_shares < p_quantity then
      raise exception 'insufficient_shares';
    end if;
    v_q_yes_after := v_market.q_yes;
    v_q_no_after := v_market.q_no - p_quantity;
  end if;

  if v_q_yes_after < 0 or v_q_no_after < 0 then
    raise exception 'invalid_quantity';
  end if;

  v_price_before := public.current_yes_price(v_market.q_yes, v_market.q_no, v_market.b);

  v_cost_before := public.lmsr_cost(v_market.q_yes, v_market.q_no, v_market.b);
  v_cost_after := public.lmsr_cost(v_q_yes_after, v_q_no_after, v_market.b);
  v_credit := floor(v_cost_before - v_cost_after);

  if v_credit <= 0 then
    raise exception 'invalid_trade_credit';
  end if;

  v_total_shares_before := v_position.yes_shares + v_position.no_shares;
  v_total_shares_after := v_total_shares_before - p_quantity;

  if v_total_shares_before <= 0 then
    raise exception 'insufficient_shares';
  end if;

  if v_total_shares_after <= 0 then
    v_sold_cost_basis := v_position.net_spent_neutrons;
  else
    v_sold_cost_basis := floor(v_position.net_spent_neutrons * (p_quantity / v_total_shares_before));
    if v_sold_cost_basis < 0 then
      v_sold_cost_basis := 0;
    end if;
    if v_sold_cost_basis > v_position.net_spent_neutrons then
      v_sold_cost_basis := v_position.net_spent_neutrons;
    end if;
  end if;

  v_realized_pnl := v_credit - v_sold_cost_basis;

  update public.markets m
  set q_yes = v_q_yes_after,
      q_no = v_q_no_after,
      volume_neutrons = volume_neutrons + v_credit
  where m.id = v_market.id;

  update public.profiles p
  set neutron_balance = neutron_balance + v_credit
  where p.id = v_user;

  if p_outcome = 'YES' then
    update public.positions pos
    set yes_shares = yes_shares - p_quantity,
        net_spent_neutrons = case
          when v_total_shares_after <= 0 then 0
          else greatest(0, net_spent_neutrons - v_sold_cost_basis)
        end,
        realized_pnl_neutrons = realized_pnl_neutrons + v_realized_pnl,
        updated_at = now()
    where pos.id = v_position.id;
  else
    update public.positions pos
    set no_shares = no_shares - p_quantity,
        net_spent_neutrons = case
          when v_total_shares_after <= 0 then 0
          else greatest(0, net_spent_neutrons - v_sold_cost_basis)
        end,
        realized_pnl_neutrons = realized_pnl_neutrons + v_realized_pnl,
        updated_at = now()
    where pos.id = v_position.id;
  end if;

  v_price_after := public.current_yes_price(v_q_yes_after, v_q_no_after, v_market.b);

  insert into public.trades (
    id,
    market_id,
    user_id,
    outcome,
    side,
    quantity,
    cost_neutrons,
    sell_proceeds_neutrons,
    sell_cost_basis_neutrons,
    realized_pnl_neutrons,
    price_before,
    price_after
  )
  values (
    v_trade_id,
    v_market.id,
    v_user,
    p_outcome,
    'SELL',
    p_quantity,
    v_credit,
    v_credit,
    v_sold_cost_basis,
    v_realized_pnl,
    v_price_before,
    v_price_after
  );

  return query
  select
    v_trade_id as trade_id,
    v_market.id as market_id,
    v_user as user_id,
    v_credit as credited_neutrons,
    v_price_before as price_before,
    v_price_after as price_after,
    (v_profile.neutron_balance + v_credit) as new_balance;
end;
$$;
