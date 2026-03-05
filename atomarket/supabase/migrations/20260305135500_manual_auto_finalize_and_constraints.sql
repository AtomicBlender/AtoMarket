-- Ensure one active/challenged proposal at a time per market.
create unique index if not exists idx_one_active_or_challenged_proposal_per_market
on public.resolution_proposals (market_id)
where status in ('ACTIVE', 'CHALLENGED');

-- Ensure at most one challenge per proposal.
create unique index if not exists idx_one_challenge_per_proposal
on public.resolution_challenges (proposal_id);

-- Auto-finalize helper for unchallenged manual proposals after challenge deadline.
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

  -- Return proposer bond when finalizing unchallenged.
  update public.profiles
  set neutron_balance = neutron_balance + v_proposal.bond_neutrons
  where id = v_proposal.proposed_by;

  -- Settle market positions using the proposed outcome.
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
    set realized_pnl_neutrons = v_payout - net_spent_neutrons,
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

grant execute on function public.finalize_active_proposal_if_unchallenged(uuid) to anon, authenticated;
