create or replace function public.submit_resolution_proposal_with_bond(
  p_market_id uuid,
  p_proposed_outcome public.outcome_type,
  p_evidence_url text default null,
  p_evidence_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_market public.markets%rowtype;
  v_existing_proposal uuid;
  v_now timestamptz := now();
  v_challenge_deadline timestamptz;
  v_proposal_id uuid := gen_random_uuid();
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_user
  for update;

  if not found then
    raise exception 'profile_not_found';
  end if;

  if coalesce(v_profile.is_active, true) = false then
    raise exception 'inactive_account';
  end if;

  select * into v_market
  from public.markets
  where id = p_market_id
  for update;

  if not found then
    raise exception 'market_not_found';
  end if;

  if v_market.resolution_type <> 'MANUAL_WITH_BOND' then
    raise exception 'manual_bond_only';
  end if;

  if v_market.status in ('RESOLVED', 'INVALID_REFUND') then
    raise exception 'market_already_finalized';
  end if;

  if v_market.resolution_deadline <= v_now then
    raise exception 'resolution_deadline_passed';
  end if;

  select rp.id into v_existing_proposal
  from public.resolution_proposals rp
  where rp.market_id = v_market.id
    and rp.status in ('ACTIVE', 'CHALLENGED')
  limit 1;

  if v_existing_proposal is not null then
    raise exception 'active_proposal_exists';
  end if;

  if v_profile.neutron_balance < v_market.proposal_bond_neutrons then
    raise exception 'insufficient_proposal_bond';
  end if;

  v_challenge_deadline := v_now + make_interval(hours => v_market.challenge_window_hours);

  insert into public.resolution_proposals (
    id,
    market_id,
    proposed_by,
    proposed_outcome,
    evidence_url,
    evidence_note,
    bond_neutrons,
    challenge_deadline,
    status
  )
  values (
    v_proposal_id,
    v_market.id,
    v_user,
    p_proposed_outcome,
    nullif(trim(p_evidence_url), ''),
    nullif(trim(p_evidence_note), ''),
    v_market.proposal_bond_neutrons,
    v_challenge_deadline,
    'ACTIVE'
  );

  update public.profiles
  set neutron_balance = neutron_balance - v_market.proposal_bond_neutrons
  where id = v_user;

  update public.markets
  set resolution_attempts = coalesce(resolution_attempts, 0) + 1,
      status = case when v_market.close_time <= v_now then 'RESOLVING' else 'OPEN' end
  where id = v_market.id;

  return v_proposal_id;
end;
$$;

grant execute on function public.submit_resolution_proposal_with_bond(uuid, public.outcome_type, text, text) to authenticated;

create or replace function public.submit_resolution_challenge_with_bond(
  p_proposal_id uuid,
  p_market_id uuid,
  p_challenge_kind public.challenge_kind,
  p_challenge_outcome public.outcome_type default null,
  p_evidence_url text default null,
  p_evidence_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_market public.markets%rowtype;
  v_proposal public.resolution_proposals%rowtype;
  v_existing_challenge uuid;
  v_now timestamptz := now();
  v_challenge_id uuid := gen_random_uuid();
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_user
  for update;

  if not found then
    raise exception 'profile_not_found';
  end if;

  if coalesce(v_profile.is_active, true) = false then
    raise exception 'inactive_account';
  end if;

  select * into v_proposal
  from public.resolution_proposals
  where id = p_proposal_id
  for update;

  if not found then
    raise exception 'proposal_not_found';
  end if;

  if v_proposal.market_id <> p_market_id then
    raise exception 'challenge_target_market_mismatch';
  end if;

  if v_proposal.status <> 'ACTIVE' then
    raise exception 'proposal_not_active';
  end if;

  if v_proposal.challenge_deadline <= v_now then
    raise exception 'challenge_window_closed';
  end if;

  if p_challenge_kind = 'OPPOSITE_OUTCOME' and p_challenge_outcome is null then
    raise exception 'challenge_outcome_required';
  end if;

  if p_challenge_kind = 'DISAGREE_NOT_RESOLVED' and p_challenge_outcome is not null then
    raise exception 'challenge_outcome_not_allowed';
  end if;

  if p_challenge_kind = 'OPPOSITE_OUTCOME' and p_challenge_outcome = v_proposal.proposed_outcome then
    raise exception 'challenge_outcome_must_be_opposite';
  end if;

  select * into v_market
  from public.markets
  where id = v_proposal.market_id
  for update;

  if not found then
    raise exception 'market_not_found';
  end if;

  if v_market.status in ('RESOLVED', 'INVALID_REFUND') then
    raise exception 'market_already_finalized';
  end if;

  select rc.id into v_existing_challenge
  from public.resolution_challenges rc
  where rc.proposal_id = v_proposal.id
  limit 1;

  if v_existing_challenge is not null then
    raise exception 'challenge_already_exists';
  end if;

  if v_profile.neutron_balance < v_market.challenge_bond_neutrons then
    raise exception 'insufficient_challenge_bond';
  end if;

  insert into public.resolution_challenges (
    id,
    proposal_id,
    market_id,
    challenged_by,
    challenge_kind,
    challenge_outcome,
    evidence_url,
    evidence_note,
    bond_neutrons
  )
  values (
    v_challenge_id,
    v_proposal.id,
    v_proposal.market_id,
    v_user,
    p_challenge_kind,
    p_challenge_outcome,
    nullif(trim(p_evidence_url), ''),
    nullif(trim(p_evidence_note), ''),
    v_market.challenge_bond_neutrons
  );

  update public.resolution_proposals
  set status = 'CHALLENGED'
  where id = v_proposal.id;

  update public.profiles
  set neutron_balance = neutron_balance - v_market.challenge_bond_neutrons
  where id = v_user;

  return v_challenge_id;
end;
$$;

grant execute on function public.submit_resolution_challenge_with_bond(uuid, uuid, public.challenge_kind, public.outcome_type, text, text) to authenticated;

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
  v_challenger_wins boolean := false;
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

      v_challenger_wins :=
        (v_challenge.challenge_kind = 'OPPOSITE_OUTCOME' and p_outcome = v_challenge.challenge_outcome)
        or (v_challenge.challenge_kind = 'DISAGREE_NOT_RESOLVED' and p_outcome <> v_proposal.proposed_outcome);

      if p_outcome = v_proposal.proposed_outcome then
        update public.profiles
        set neutron_balance = neutron_balance + v_proposal.bond_neutrons + v_challenge.bond_neutrons
        where id = v_proposal.proposed_by;

        update public.resolution_proposals
        set status = 'FINALIZED'
        where id = v_proposal.id;
      elsif v_challenger_wins then
        update public.profiles
        set neutron_balance = neutron_balance + v_challenge.bond_neutrons + v_proposal.bond_neutrons
        where id = v_challenge.challenged_by;

        update public.resolution_proposals
        set status = 'REJECTED'
        where id = v_proposal.id;
      else
        update public.profiles
        set neutron_balance = neutron_balance + v_proposal.bond_neutrons + v_challenge.bond_neutrons
        where id = v_proposal.proposed_by;

        update public.resolution_proposals
        set status = 'FINALIZED'
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

grant execute on function public.admin_resolve_market_with_bonds(uuid, public.outcome_type, text) to authenticated;
