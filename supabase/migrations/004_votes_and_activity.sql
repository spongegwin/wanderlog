-- Votes on suggested blocks (display only — no auto-promote)
create table if not exists block_votes (
  id uuid primary key default uuid_generate_v4(),
  block_id uuid references itinerary_blocks(id) on delete cascade,
  user_id uuid references auth.users(id),
  vote text check (vote in ('up','down')),
  created_at timestamptz default now(),
  unique(block_id, user_id)
);
alter table block_votes enable row level security;

create policy "trip members read votes"
  on block_votes for select using (
    exists (
      select 1 from itinerary_blocks b
      join participants p on p.trip_id = b.trip_id
      where b.id = block_votes.block_id and p.user_id = auth.uid()
    )
  );
create policy "users manage own vote"
  on block_votes for all using (user_id = auth.uid());

-- Activity feed (lean)
create table if not exists activity_log (
  id uuid primary key default uuid_generate_v4(),
  trip_id uuid references trips(id) on delete cascade,
  user_id uuid references auth.users(id),
  actor_name text,
  action text not null,
  target_id uuid,
  summary text,
  created_at timestamptz default now()
);
create index if not exists activity_log_trip_idx on activity_log (trip_id, created_at desc);
alter table activity_log enable row level security;

create policy "trip members read activity"
  on activity_log for select using (
    exists (select 1 from participants where trip_id = activity_log.trip_id and user_id = auth.uid())
  );
create policy "authenticated users log"
  on activity_log for insert with check (auth.uid() = user_id);
