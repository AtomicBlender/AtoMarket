create or replace function public.admin_defer_market_with_bonds(
  p_market_id uuid,
  p_notes text
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
  v_now timestamptz := now();
  v_next_status public.market_status;
  v_note text;
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

  -- Pick current blocking proposal if one exists.
  select * into v_proposal
  from public.resolution_proposals
  where market_id = p_market_id and status in ('ACTIVE', 'CHALLENGED')
  order by created_at desc
  limit 1
  for update;

  if found then
    -- Return proposer bond.
    update public.profiles
    set neutron_balance = neutron_balance + v_proposal.bond_neutrons
    where id = v_proposal.proposed_by;

    -- Return first challenge bond if this proposal was challenged.
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

    update public.resolution_proposals
    set status = 'REJECTED'
    where id = v_proposal.id;
  end if;

  if v_now < v_market.resolution_deadline then
    v_next_status := 'OPEN';
  else
    v_next_status := 'RESOLVING';
  end if;

  v_note := format('[%s] Deferred: %s', v_now::text, coalesce(nullif(trim(p_notes), ''), 'No reason provided'));

  update public.markets
  set status = v_next_status,
      resolution_notes = case when resolution_notes is null then v_note else resolution_notes || E'\n' || v_note end
  where id = p_market_id;

  if v_next_status = 'OPEN' then
    return 'deferred_reopened';
  end if;

  return 'deferred_deadline_passed';
end;
$$;

grant execute on function public.admin_defer_market_with_bonds(uuid, text) to authenticated;
