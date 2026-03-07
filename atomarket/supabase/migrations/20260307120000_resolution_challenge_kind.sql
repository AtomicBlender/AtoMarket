create type public.challenge_kind as enum ('OPPOSITE_OUTCOME', 'DISAGREE_NOT_RESOLVED');

alter table public.resolution_challenges
  add column if not exists challenge_kind public.challenge_kind;

update public.resolution_challenges
set challenge_kind = 'OPPOSITE_OUTCOME'
where challenge_kind is null;

alter table public.resolution_challenges
  alter column challenge_kind set not null;

alter table public.resolution_challenges
  alter column challenge_kind set default 'OPPOSITE_OUTCOME';

alter table public.resolution_challenges
  alter column challenge_outcome drop not null;

alter table public.resolution_challenges
  drop constraint if exists resolution_challenges_kind_consistency;

alter table public.resolution_challenges
  add constraint resolution_challenges_kind_consistency
  check (
    (challenge_kind = 'OPPOSITE_OUTCOME' and challenge_outcome is not null)
    or (challenge_kind = 'DISAGREE_NOT_RESOLVED' and challenge_outcome is null)
  );

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
      elsif v_challenge.challenge_kind = 'OPPOSITE_OUTCOME' and p_outcome = v_challenge.challenge_outcome then
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

grant execute on function public.admin_resolve_market_with_bonds(uuid, public.outcome_type, text) to authenticated;
