create or replace function public.profile_display_name_from_email(
  p_email text
)
returns text
language plpgsql
immutable
as $$
declare
  v_local text := nullif(split_part(coalesce(trim(p_email), ''), '@', 1), '');
begin
  if v_local is null then
    return 'user';
  end if;
  return left(v_local, 64);
end;
$$;

create or replace function public.profile_username_base_from_email(
  p_email text
)
returns text
language plpgsql
immutable
as $$
declare
  v_local text := lower(nullif(split_part(coalesce(trim(p_email), ''), '@', 1), ''));
begin
  if v_local is null then
    return 'user';
  end if;

  v_local := regexp_replace(v_local, '[^a-z0-9_]', '_', 'g');
  v_local := regexp_replace(v_local, '_+', '_', 'g');
  v_local := regexp_replace(v_local, '^_+|_+$', '', 'g');

  if v_local = '' then
    v_local := 'user';
  end if;

  if length(v_local) < 3 then
    v_local := rpad(v_local, 3, '0');
  end if;

  return left(v_local, 20);
end;
$$;

create or replace function public.generate_unique_profile_username(
  p_email text
)
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  v_base text := public.profile_username_base_from_email(p_email);
  v_candidate text;
  v_is_unique boolean := false;
begin
  for i in 1..200 loop
    v_candidate := v_base || lpad(((floor(random() * 10000))::int)::text, 4, '0');
    v_is_unique := not exists (
      select 1
      from public.profiles p
      where lower(p.username) = lower(v_candidate)
    );
    exit when v_is_unique;
  end loop;

  if not v_is_unique then
    raise exception 'unable_to_generate_unique_username';
  end if;

  return v_candidate;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text := public.profile_display_name_from_email(new.email);
  v_username text;
begin
  for i in 1..50 loop
    v_username := public.generate_unique_profile_username(new.email);
    begin
      insert into public.profiles (id, display_name, username)
      values (new.id, v_display_name, v_username)
      on conflict (id) do update
      set
        display_name = coalesce(nullif(trim(public.profiles.display_name), ''), excluded.display_name),
        username = coalesce(public.profiles.username, excluded.username);
      return new;
    exception
      when unique_violation then
        -- Retry on rare random suffix collision from concurrent inserts.
    end;
  end loop;

  raise exception 'unable_to_insert_profile_for_new_user';
end;
$$;

do $$
declare
  v_rec record;
  v_username text;
  v_display_name text;
  v_updated boolean;
begin
  for v_rec in
    select p.id, p.username, p.display_name, u.email
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.username is null
       or nullif(trim(p.display_name), '') is null
       or position('@' in coalesce(p.display_name, '')) > 0
  loop
    v_display_name := case
      when nullif(trim(v_rec.display_name), '') is null
        or position('@' in coalesce(v_rec.display_name, '')) > 0
      then public.profile_display_name_from_email(v_rec.email)
      else v_rec.display_name
    end;

    if v_rec.username is null then
      v_updated := false;
      for i in 1..50 loop
        v_username := public.generate_unique_profile_username(v_rec.email);
        begin
          update public.profiles p
          set
            display_name = v_display_name,
            username = v_username
          where p.id = v_rec.id;
          v_updated := true;
          exit;
        exception
          when unique_violation then
            -- Retry on rare random suffix collision.
        end;
      end loop;
      if not v_updated then
        raise exception 'unable_to_backfill_username_for_profile_%', v_rec.id;
      end if;
    else
      update public.profiles p
      set display_name = v_display_name
      where p.id = v_rec.id;
    end if;
  end loop;
end;
$$;

alter table public.profiles
  alter column username set not null;
