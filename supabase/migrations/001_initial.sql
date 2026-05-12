create extension if not exists "uuid-ossp";

create table trips (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  destination   text,
  status        text not null default 'upcoming' check (status in ('upcoming','past')),
  start_date    date,
  end_date      date,
  essence       text,
  photo_1_url   text,
  photo_2_url   text,
  invite_token  text unique default encode(gen_random_bytes(6), 'hex'),
  created_by    uuid references auth.users(id),
  created_at    timestamptz default now()
);

create table participants (
  id         uuid primary key default uuid_generate_v4(),
  trip_id    uuid references trips(id) on delete cascade,
  user_id    uuid references auth.users(id),
  name       text,
  role       text default 'confirmed' check (role in ('organizer','confirmed','maybe','invited')),
  color      text,
  joined_at  timestamptz default now(),
  unique(trip_id, user_id)
);

create table itinerary_blocks (
  id              uuid primary key default uuid_generate_v4(),
  trip_id         uuid references trips(id) on delete cascade,
  type            text not null check (type in ('flight','stay','activity','meal','transport','hike','rest','idea')),
  icon            text,
  title           text not null,
  subtitle        text,
  status          text default 'idea' check (status in ('idea','suggested','confirmed','completed')),
  day_label       text,
  sort_order      int default 0,
  booking_conf    text,
  booking_details text,
  booking_link    text,
  cancel_deadline date,
  hike_start      text,
  hike_start_elev text,
  hike_end        text,
  hike_end_elev   text,
  hike_distance   text,
  hike_elev_gain  text,
  hike_est_hours  text,
  hike_difficulty text check (hike_difficulty in ('easy','moderate','strenuous')),
  hike_has_variant boolean default false,
  hike_variant_note text,
  hike_elev_profile jsonb,
  weather_high    text,
  weather_low     text,
  weather_note    text,
  cost_amount     numeric,
  cost_currency   text default 'USD',
  added_by        uuid references auth.users(id),
  created_at      timestamptz default now()
);

create table block_bookings (
  id         uuid primary key default uuid_generate_v4(),
  block_id   uuid references itinerary_blocks(id) on delete cascade,
  user_id    uuid references auth.users(id),
  name       text,
  conf_number text,
  booked_at  timestamptz default now(),
  unique(block_id, user_id)
);

create table comments (
  id          uuid primary key default uuid_generate_v4(),
  block_id    uuid references itinerary_blocks(id) on delete cascade,
  user_id     uuid references auth.users(id),
  author_name text,
  author_color text,
  text        text not null,
  created_at  timestamptz default now()
);

create table reactions (
  id         uuid primary key default uuid_generate_v4(),
  block_id   uuid references itinerary_blocks(id) on delete cascade,
  user_id    uuid references auth.users(id),
  emoji      text not null,
  created_at timestamptz default now(),
  unique(block_id, user_id, emoji)
);

create table resources (
  id          uuid primary key default uuid_generate_v4(),
  trip_id     uuid references trips(id) on delete cascade,
  category    text check (category in ('trail_map','guide','booking','community','other')),
  title       text,
  url         text not null,
  description text,
  added_by    uuid references auth.users(id),
  created_at  timestamptz default now()
);

alter table trips enable row level security;
alter table participants enable row level security;
alter table itinerary_blocks enable row level security;
alter table block_bookings enable row level security;
alter table comments enable row level security;
alter table reactions enable row level security;
alter table resources enable row level security;

create policy "trip members can read trips"
  on trips for select using (
    exists (select 1 from participants where trip_id = trips.id and user_id = auth.uid())
    or created_by = auth.uid()
  );

create policy "authenticated users can create trips"
  on trips for insert with check (auth.uid() = created_by);

create policy "trip creator can update trips"
  on trips for update using (created_by = auth.uid());

-- security definer function avoids infinite recursion in the self-referential RLS check
create or replace function auth_user_is_trip_member(p_trip_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists(
    select 1 from public.participants
    where participants.trip_id = p_trip_id
      and participants.user_id = auth.uid()
  )
$$;

create policy "trip members can read participants"
  on participants for select using (
    auth_user_is_trip_member(trip_id)
  );

create policy "authenticated users can join trips"
  on participants for insert with check (auth.uid() = user_id);

create policy "trip members can read blocks"
  on itinerary_blocks for select using (
    exists (
      select 1 from participants p join trips t on p.trip_id = t.id
      where t.id = itinerary_blocks.trip_id and p.user_id = auth.uid()
    )
  );

create policy "trip members can insert blocks"
  on itinerary_blocks for insert with check (
    exists (select 1 from participants where trip_id = itinerary_blocks.trip_id and user_id = auth.uid())
  );

create policy "trip members can update blocks"
  on itinerary_blocks for update using (
    exists (select 1 from participants where trip_id = itinerary_blocks.trip_id and user_id = auth.uid())
  );

create policy "trip members can read bookings"
  on block_bookings for select using (
    exists (
      select 1 from itinerary_blocks b join participants p on p.trip_id = b.trip_id
      where b.id = block_bookings.block_id and p.user_id = auth.uid()
    )
  );

create policy "users manage own bookings"
  on block_bookings for all using (user_id = auth.uid());

create policy "trip members can read comments"
  on comments for select using (
    exists (
      select 1 from itinerary_blocks b join participants p on p.trip_id = b.trip_id
      where b.id = comments.block_id and p.user_id = auth.uid()
    )
  );

create policy "trip members can insert comments"
  on comments for insert with check (
    exists (
      select 1 from itinerary_blocks b join participants p on p.trip_id = b.trip_id
      where b.id = comments.block_id and p.user_id = auth.uid()
    )
  );

create policy "trip members can read reactions"
  on reactions for select using (
    exists (
      select 1 from itinerary_blocks b join participants p on p.trip_id = b.trip_id
      where b.id = reactions.block_id and p.user_id = auth.uid()
    )
  );

create policy "users manage own reactions"
  on reactions for all using (user_id = auth.uid());

create policy "trip members can read resources"
  on resources for select using (
    exists (select 1 from participants where trip_id = resources.trip_id and user_id = auth.uid())
  );

create policy "trip members can add resources"
  on resources for insert with check (
    exists (select 1 from participants where trip_id = resources.trip_id and user_id = auth.uid())
  );
