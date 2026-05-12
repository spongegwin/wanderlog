-- Token-gated guest access for the invite link flow.
-- These functions are the ONLY way an unauthenticated or non-member caller
-- can read a trip's data. They verify (trip_id, invite_token) before bypassing
-- RLS via security definer. Write functions also require auth.uid().

-- ---------- get_trip_preview_by_token ----------
-- Returns a JSONB bundle of public-preview data when the token matches.
-- Returns NULL when the token is wrong or the trip is missing — caller renders
-- the "Invite link not found" state.

create or replace function get_trip_preview_by_token(
  p_trip_id uuid,
  p_token text
)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_trip public.trips;
  v_result jsonb;
begin
  select * into v_trip
  from public.trips
  where id = p_trip_id
    and invite_token = p_token;

  if not found then
    return null;
  end if;

  select jsonb_build_object(
    'trip', to_jsonb(v_trip),
    'participants', coalesce(
      (select jsonb_agg(to_jsonb(p) order by p.joined_at)
       from public.participants p
       where p.trip_id = v_trip.id),
      '[]'::jsonb
    ),
    'itinerary_blocks', coalesce(
      (select jsonb_agg(to_jsonb(b) order by b.sort_order, b.created_at)
       from public.itinerary_blocks b
       where b.trip_id = v_trip.id),
      '[]'::jsonb
    ),
    'block_bookings', coalesce(
      (select jsonb_agg(to_jsonb(bk))
       from public.block_bookings bk
       join public.itinerary_blocks ib on ib.id = bk.block_id
       where ib.trip_id = v_trip.id),
      '[]'::jsonb
    ),
    'packing_items', coalesce(
      (select jsonb_agg(to_jsonb(pi) order by pi.category, pi.sort_order)
       from public.packing_items pi
       where pi.trip_id = v_trip.id and pi.deleted_at is null),
      '[]'::jsonb
    ),
    'resources', coalesce(
      (select jsonb_agg(to_jsonb(r) order by r.created_at)
       from public.resources r
       where r.trip_id = v_trip.id),
      '[]'::jsonb
    )
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function get_trip_preview_by_token(uuid, text) to anon, authenticated;


-- ---------- claim_participant_by_token ----------
-- Lets an authenticated guest claim an unclaimed participant slot when they
-- present a matching invite token. Logs the link to activity_log.

create or replace function claim_participant_by_token(
  p_participant_id uuid,
  p_trip_id uuid,
  p_token text
)
returns public.participants
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_token_ok boolean;
  v_existing_user uuid;
  v_participant_name text;
  v_row public.participants;
begin
  if v_uid is null then
    raise exception 'must be signed in to claim a participant slot';
  end if;

  select exists(
    select 1 from public.trips
    where id = p_trip_id and invite_token = p_token
  ) into v_token_ok;

  if not v_token_ok then
    raise exception 'invalid invite token';
  end if;

  select user_id, name
  into v_existing_user, v_participant_name
  from public.participants
  where id = p_participant_id and trip_id = p_trip_id
  for update;

  if not found then
    raise exception 'participant slot not found';
  end if;

  if v_existing_user is not null then
    raise exception 'this slot is already claimed';
  end if;

  update public.participants
  set user_id = v_uid
  where id = p_participant_id
  returning * into v_row;

  insert into public.activity_log (trip_id, user_id, actor_name, action, target_id, summary)
  values (
    p_trip_id,
    v_uid,
    v_participant_name,
    'participant.linked',
    p_participant_id,
    'linked their profile to ' || coalesce(v_participant_name, 'an unlinked participant')
  );

  return v_row;
end;
$$;

grant execute on function claim_participant_by_token(uuid, uuid, text) to authenticated;


-- ---------- join_trip_by_token ----------
-- Lets an authenticated guest join a trip as a new participant when they
-- present a matching invite token. Idempotent: returns the existing row if
-- the caller is already a member.

create or replace function join_trip_by_token(
  p_trip_id uuid,
  p_token text,
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
  v_token_ok boolean;
  v_count int;
  v_color text;
  v_row public.participants;
  v_palette text[] := array[
    '#c45c2e', '#4a7c59', '#3a6b8a', '#8b5e3c',
    '#7c4a7c', '#5a7c4a', '#3a5a8a', '#8a3a3a'
  ];
  v_clean_name text;
begin
  if v_uid is null then
    raise exception 'must be signed in to join';
  end if;

  select exists(
    select 1 from public.trips
    where id = p_trip_id and invite_token = p_token
  ) into v_token_ok;

  if not v_token_ok then
    raise exception 'invalid invite token';
  end if;

  -- Already a member? Return that row, don't duplicate.
  select * into v_row
  from public.participants
  where trip_id = p_trip_id and user_id = v_uid;
  if found then
    return v_row;
  end if;

  v_clean_name := nullif(btrim(p_name), '');
  if v_clean_name is null then
    raise exception 'name is required';
  end if;

  select count(*) into v_count from public.participants where trip_id = p_trip_id;
  v_color := v_palette[(v_count % array_length(v_palette, 1)) + 1];

  insert into public.participants (trip_id, user_id, name, role, color)
  values (p_trip_id, v_uid, v_clean_name, 'confirmed', v_color)
  returning * into v_row;

  insert into public.activity_log (trip_id, user_id, actor_name, action, target_id, summary)
  values (
    p_trip_id,
    v_uid,
    v_clean_name,
    'participant.joined',
    v_row.id,
    v_clean_name || ' joined the trip'
  );

  return v_row;
end;
$$;

grant execute on function join_trip_by_token(uuid, text, text) to authenticated;
