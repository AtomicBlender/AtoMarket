alter table public.trades
  add column if not exists sell_proceeds_neutrons bigint,
  add column if not exists sell_cost_basis_neutrons bigint,
  add column if not exists realized_pnl_neutrons bigint;

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
      q_no = v_q_no_after
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

create or replace function public.finalize_market_yes_no(
  p_market_id uuid,
  p_outcome public.outcome_type,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_market public.markets%rowtype;
  v_position record;
  v_payout bigint;
  v_user uuid := auth.uid();
  v_is_admin boolean := false;
begin
  select is_admin into v_is_admin from public.profiles where id = v_user;
  if coalesce(v_is_admin, false) = false then
    raise exception 'admin_required';
  end if;

  select * into v_market from public.markets where id = p_market_id for update;
  if not found then
    raise exception 'market_not_found';
  end if;

  if v_market.status in ('RESOLVED', 'INVALID_REFUND') then
    return;
  end if;

  for v_position in
    select * from public.positions where market_id = p_market_id and (yes_shares > 0 or no_shares > 0)
  loop
    if p_outcome = 'YES' then
      v_payout := floor(v_position.yes_shares);
    else
      v_payout := floor(v_position.no_shares);
    end if;

    update public.profiles
    set neutron_balance = neutron_balance + v_payout
    where id = v_position.user_id;

    update public.positions
    set realized_pnl_neutrons = realized_pnl_neutrons + (v_payout - net_spent_neutrons),
        yes_shares = 0,
        no_shares = 0,
        net_spent_neutrons = 0,
        updated_at = now()
    where id = v_position.id;
  end loop;

  update public.markets
  set status = 'RESOLVED',
      resolved_outcome = p_outcome,
      resolution_notes = p_notes,
      resolved_at = now()
  where id = p_market_id;
end;
$$;

create or replace function public.finalize_market_invalid_refund(
  p_market_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_market public.markets%rowtype;
  v_position record;
  v_user uuid := auth.uid();
  v_is_admin boolean := false;
begin
  select is_admin into v_is_admin from public.profiles where id = v_user;
  if coalesce(v_is_admin, false) = false then
    raise exception 'admin_required';
  end if;

  select * into v_market from public.markets where id = p_market_id for update;
  if not found then
    raise exception 'market_not_found';
  end if;

  if v_market.status in ('RESOLVED', 'INVALID_REFUND') then
    return;
  end if;

  for v_position in
    select * from public.positions where market_id = p_market_id and net_spent_neutrons > 0
  loop
    update public.profiles
    set neutron_balance = neutron_balance + v_position.net_spent_neutrons
    where id = v_position.user_id;

    update public.positions
    set yes_shares = 0,
        no_shares = 0,
        net_spent_neutrons = 0,
        updated_at = now()
    where id = v_position.id;
  end loop;

  update public.markets
  set status = 'INVALID_REFUND',
      invalid_reason = p_reason,
      resolved_at = now()
  where id = p_market_id;
end;
$$;

create or replace function public.finalize_active_proposal_if_unchallenged(
  p_proposal_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal public.resolution_proposals%rowtype;
  v_market public.markets%rowtype;
  v_position record;
  v_has_challenge boolean := false;
  v_payout bigint;
begin
  select * into v_proposal
  from public.resolution_proposals
  where id = p_proposal_id
  for update;

  if not found then
    return 'proposal_not_found';
  end if;

  if v_proposal.status <> 'ACTIVE' then
    return 'proposal_not_active';
  end if;

  if now() < v_proposal.challenge_deadline then
    return 'challenge_window_open';
  end if;

  select * into v_market
  from public.markets
  where id = v_proposal.market_id
  for update;

  if not found then
    return 'market_not_found';
  end if;

  if v_market.status in ('RESOLVED', 'INVALID_REFUND') then
    return 'market_already_finalized';
  end if;

  if now() > v_market.resolution_deadline then
    return 'resolution_deadline_passed';
  end if;

  select exists (
    select 1 from public.resolution_challenges c where c.proposal_id = v_proposal.id
  ) into v_has_challenge;

  if v_has_challenge then
    update public.resolution_proposals
    set status = 'CHALLENGED'
    where id = v_proposal.id;
    return 'proposal_challenged';
  end if;

  update public.profiles
  set neutron_balance = neutron_balance + v_proposal.bond_neutrons
  where id = v_proposal.proposed_by;

  for v_position in
    select *
    from public.positions
    where market_id = v_market.id and (yes_shares > 0 or no_shares > 0)
  loop
    if v_proposal.proposed_outcome = 'YES' then
      v_payout := floor(v_position.yes_shares);
    else
      v_payout := floor(v_position.no_shares);
    end if;

    update public.profiles
    set neutron_balance = neutron_balance + v_payout
    where id = v_position.user_id;

    update public.positions
    set realized_pnl_neutrons = realized_pnl_neutrons + (v_payout - net_spent_neutrons),
        yes_shares = 0,
        no_shares = 0,
        net_spent_neutrons = 0,
        updated_at = now()
    where id = v_position.id;
  end loop;

  update public.markets
  set status = 'RESOLVED',
      resolved_outcome = v_proposal.proposed_outcome,
      resolution_notes = coalesce(v_market.resolution_notes, 'Finalized automatically from unchallenged proposal.'),
      resolved_at = now()
  where id = v_market.id;

  update public.resolution_proposals
  set status = 'FINALIZED'
  where id = v_proposal.id;

  return 'finalized';
end;
$$;

create or replace function public.admin_resolve_market_with_bonds(
  p_market_id uuid,
  p_outcome public.outcome_type,
  p_notes text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_is_admin boolean := false;
  v_market public.markets%rowtype;
  v_proposal public.resolution_proposals%rowtype;
  v_challenge public.resolution_challenges%rowtype;
  v_position record;
  v_payout bigint;
  v_had_challenged boolean := false;
begin
  select is_admin into v_is_admin from public.profiles where id = v_user;
  if coalesce(v_is_admin, false) = false then
    raise exception 'admin_required';
  end if;

  select * into v_market
  from public.markets
  where id = p_market_id
  for update;

  if not found then
    raise exception 'market_not_found';
  end if;

  if v_market.status in ('RESOLVED', 'INVALID_REFUND') then
    return 'market_already_finalized';
  end if;

  select * into v_proposal
  from public.resolution_proposals
  where market_id = p_market_id and status in ('ACTIVE', 'CHALLENGED')
  order by created_at desc
  limit 1
  for update;

  if found then
    if v_proposal.status = 'CHALLENGED' then
      v_had_challenged := true;

      select * into v_challenge
      from public.resolution_challenges
      where proposal_id = v_proposal.id
      order by created_at asc
      limit 1
      for update;

      if not found then
        raise exception 'challenge_not_found_for_proposal';
      end if;

      if p_outcome = v_proposal.proposed_outcome then
        update public.profiles
        set neutron_balance = neutron_balance + v_proposal.bond_neutrons + v_challenge.bond_neutrons
        where id = v_proposal.proposed_by;

        update public.resolution_proposals
        set status = 'FINALIZED'
        where id = v_proposal.id;
      elsif p_outcome = v_challenge.challenge_outcome then
        update public.profiles
        set neutron_balance = neutron_balance + v_challenge.bond_neutrons + v_proposal.bond_neutrons
        where id = v_challenge.challenged_by;

        update public.resolution_proposals
        set status = 'REJECTED'
        where id = v_proposal.id;
      else
        update public.profiles
        set neutron_balance = neutron_balance + v_proposal.bond_neutrons
        where id = v_proposal.proposed_by;

        update public.profiles
        set neutron_balance = neutron_balance + v_challenge.bond_neutrons
        where id = v_challenge.challenged_by;

        update public.resolution_proposals
        set status = 'REJECTED'
        where id = v_proposal.id;
      end if;
    else
      update public.profiles
      set neutron_balance = neutron_balance + v_proposal.bond_neutrons
      where id = v_proposal.proposed_by;

      if p_outcome = v_proposal.proposed_outcome then
        update public.resolution_proposals
        set status = 'FINALIZED'
        where id = v_proposal.id;
      else
        update public.resolution_proposals
        set status = 'REJECTED'
        where id = v_proposal.id;
      end if;
    end if;
  end if;

  for v_position in
    select * from public.positions where market_id = p_market_id and (yes_shares > 0 or no_shares > 0)
  loop
    if p_outcome = 'YES' then
      v_payout := floor(v_position.yes_shares);
    else
      v_payout := floor(v_position.no_shares);
    end if;

    update public.profiles
    set neutron_balance = neutron_balance + v_payout
    where id = v_position.user_id;

    update public.positions
    set realized_pnl_neutrons = realized_pnl_neutrons + (v_payout - net_spent_neutrons),
        yes_shares = 0,
        no_shares = 0,
        net_spent_neutrons = 0,
        updated_at = now()
    where id = v_position.id;
  end loop;

  update public.markets
  set status = 'RESOLVED',
      resolved_outcome = p_outcome,
      resolution_notes = p_notes,
      resolved_at = now()
  where id = p_market_id;

  if v_had_challenged then
    return 'resolved_challenged';
  end if;

  return 'resolved';
end;
$$;

create or replace function public.admin_invalidate_market_with_bonds(
  p_market_id uuid,
  p_reason text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_is_admin boolean := false;
  v_market public.markets%rowtype;
  v_proposal public.resolution_proposals%rowtype;
  v_challenge public.resolution_challenges%rowtype;
  v_position record;
  v_had_challenged boolean := false;
begin
  select is_admin into v_is_admin from public.profiles where id = v_user;
  if coalesce(v_is_admin, false) = false then
    raise exception 'admin_required';
  end if;

  select * into v_market
  from public.markets
  where id = p_market_id
  for update;

  if not found then
    raise exception 'market_not_found';
  end if;

  if v_market.status in ('RESOLVED', 'INVALID_REFUND') then
    return 'market_already_finalized';
  end if;

  select * into v_proposal
  from public.resolution_proposals
  where market_id = p_market_id and status in ('ACTIVE', 'CHALLENGED')
  order by created_at desc
  limit 1
  for update;

  if found then
    update public.profiles
    set neutron_balance = neutron_balance + v_proposal.bond_neutrons
    where id = v_proposal.proposed_by;

    if v_proposal.status = 'CHALLENGED' then
      v_had_challenged := true;

      select * into v_challenge
      from public.resolution_challenges
      where proposal_id = v_proposal.id
      order by created_at asc
      limit 1
      for update;

      if found then
        update public.profiles
        set neutron_balance = neutron_balance + v_challenge.bond_neutrons
        where id = v_challenge.challenged_by;
      end if;
    end if;

    update public.resolution_proposals
    set status = 'REJECTED'
    where id = v_proposal.id;
  end if;

  for v_position in
    select * from public.positions where market_id = p_market_id and net_spent_neutrons > 0
  loop
    update public.profiles
    set neutron_balance = neutron_balance + v_position.net_spent_neutrons
    where id = v_position.user_id;

    update public.positions
    set yes_shares = 0,
        no_shares = 0,
        net_spent_neutrons = 0,
        updated_at = now()
    where id = v_position.id;
  end loop;

  update public.markets
  set status = 'INVALID_REFUND',
      invalid_reason = p_reason,
      resolved_at = now()
  where id = p_market_id;

  if v_had_challenged then
    return 'invalidated_challenged';
  end if;

  return 'invalidated';
end;
$$;
