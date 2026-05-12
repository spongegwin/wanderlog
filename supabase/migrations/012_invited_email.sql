-- Pending-invite plumbing: addressable email-based invites with explicit accept.
--
-- A participants row is one of three states:
--   joined           user_id IS NOT NULL
--   pending invite   user_id IS NULL AND invited_email IS NOT NULL
--   unclaimed slot   user_id IS NULL AND invited_email IS NULL  (organizer free-text)

alter table public.participants
  add column if not exists invited_email text;

create index if not exists participants_invited_email_idx
  on public.participants (lower(invited_email))
  where user_id is null and invited_email is not null;


-- ---------- find_past_cotrippers ----------
-- Returns people the caller has shared at least one trip with, ranked by
-- shared-trip count. Optional substring filter on display name.

create or replace function find_past_cotrippers(p_query text)
returns table (user_id uuid, name text, email text, trips_shared int)
language sql
security definer
stable
set search_path = ''
as $$
  with my_trips as (
    select trip_id from public.participants where user_id = auth.uid()
  ),
  candidates as (
    select p.user_id, p.name
    from public.participants p
    where p.trip_id in (select trip_id from my_trips)
      and p.user_id is not null
      and p.user_id <> auth.uid()
  )
  select
    c.user_id,
    coalesce(max(c.name), '') as name,
    (select u.email from auth.users u where u.id = c.user_id) as email,
    count(*)::int as trips_shared
  from candidates c
  group by c.user_id
  having coalesce(p_query, '') = ''
      or max(c.name) ilike '%' || p_query || '%'
      or exists (
        select 1 from auth.users u
        where u.id = c.user_id and u.email ilike '%' || p_query || '%'
      )
  order by trips_shared desc, max(c.name) asc
  limit 20;
$$;

grant execute on function find_past_cotrippers(text) to authenticated;


-- ---------- find_user_by_email ----------
-- Exact-email lookup of a registered user. Caller must already know the
-- email — no enumeration possible since LIKE is forbidden here.

create or replace function find_user_by_email(p_email text)
returns table (user_id uuid, name text)
language sql
security definer
stable
set search_path = ''
as $$
  select
    u.id as user_id,
    coalesce(u.raw_user_meta_data ->> 'full_name', u.email) as name
  from auth.users u
  where auth.uid() is not null
    and lower(u.email) = lower(btrim(p_email))
  limit 1;
$$;

grant execute on function find_user_by_email(text) to authenticated;


-- ---------- invite_pending_participant ----------
-- Trip member creates a pending invite addressed to an email.
-- Idempotent: if a matching pending row exists, returns it without inserting.

create or replace function invite_pending_participant(
  p_trip_id uuid,
  p_email text,
  p_name text
)
returns public.participants
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(btrim(p_email));
  v_name text := nullif(btrim(p_name), '');
  v_count int;
  v_color text;
  v_row public.participants;
  v_existing_user_id uuid;
  v_palette text[] := array[
    '#c45c2e', '#4a7c59', '#3a6b8a', '#8b5e3c',
    '#7c4a7c', '#5a7c4a', '#3a5a8a', '#8a3a3a'
  ];
begin
  if v_uid is null then
    raise exception 'must be signed in';
  end if;

  if not public.auth_user_is_trip_member(p_trip_id) then
    raise exception 'only trip members can invite';
  end if;

  if v_email is null or v_email = '' then
    raise exception 'email is required';
  end if;

  -- Already an active member with this email?
  select p.user_id into v_existing_user_id
  from public.participants p
  join auth.users u on u.id = p.user_id
  where p.trip_id = p_trip_id and lower(u.email) = v_email
  limit 1;
  if v_existing_user_id is not null then
    raise exception 'that user is already a member of this trip';
  end if;

  -- Existing pending row?
  select * into v_row
  from public.participants
  where trip_id = p_trip_id
    and user_id is null
    and lower(invited_email) = v_email
  limit 1;
  if found then
    return v_row;
  end if;

  select count(*) into v_count from public.participants where trip_id = p_trip_id;
  v_color := v_palette[(v_count % array_length(v_palette, 1)) + 1];

  insert into public.participants (trip_id, user_id, name, invited_email, role, color)
  values (p_trip_id, null, coalesce(v_name, v_email), v_email, 'invited', v_color)
  returning * into v_row;

  insert into public.activity_log (trip_id, user_id, actor_name, action, target_id, summary)
  values (
    p_trip_id,
    v_uid,
    null,
    'participant.invited',
    v_row.id,
    'invited ' || coalesce(v_name, v_email)
  );

  return v_row;
end;
$$;

grant execute on function invite_pending_participant(uuid, text, text) to authenticated;


-- ---------- accept_pending_invite ----------
-- The invitee claims the slot by matching auth.email() to invited_email.

create or replace function accept_pending_invite(p_participant_id uuid)
returns public.participants
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_row public.participants;
begin
  if v_uid is null then
    raise exception 'must be signed in';
  end if;

  select lower(u.email) into v_email from auth.users u where u.id = v_uid;

  select * into v_row from public.participants where id = p_participant_id for update;
  if not found then
    raise exception 'invite not found';
  end if;
  if v_row.user_id is not null then
    raise exception 'this invite has already been accepted';
  end if;
  if v_row.invited_email is null or lower(v_row.invited_email) <> v_email then
    raise exception 'this invite is not addressed to your email';
  end if;

  update public.participants
  set user_id = v_uid
  where id = p_participant_id
  returning * into v_row;

  insert into public.activity_log (trip_id, user_id, actor_name, action, target_id, summary)
  values (
    v_row.trip_id,
    v_uid,
    v_row.name,
    'participant.linked',
    v_row.id,
    'accepted invite'
  );

  return v_row;
end;
$$;

grant execute on function accept_pending_invite(uuid) to authenticated;


-- ---------- list_pending_invites_for_me ----------

create or replace function list_pending_invites_for_me()
returns table (
  participant_id uuid,
  trip_id uuid,
  trip_name text,
  trip_destination text,
  invited_email text,
  name text
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    p.id as participant_id,
    t.id as trip_id,
    t.name as trip_name,
    t.destination as trip_destination,
    p.invited_email,
    p.name
  from public.participants p
  join public.trips t on t.id = p.trip_id
  join auth.users u on u.id = auth.uid()
  where p.user_id is null
    and p.invited_email is not null
    and lower(p.invited_email) = lower(u.email)
  order by t.created_at desc;
$$;

grant execute on function list_pending_invites_for_me() to authenticated;
