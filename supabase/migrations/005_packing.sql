create table if not exists packing_items (
  id uuid primary key default uuid_generate_v4(),
  trip_id uuid references trips(id) on delete cascade,
  label text not null,
  category text default 'Other',
  assigned_to uuid references participants(id) on delete set null,
  packed boolean default false,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
create index if not exists packing_items_trip_idx on packing_items (trip_id, category);
alter table packing_items enable row level security;

create policy "trip members read packing"
  on packing_items for select using (
    exists (select 1 from participants where trip_id = packing_items.trip_id and user_id = auth.uid())
  );
create policy "trip members manage packing"
  on packing_items for all using (
    exists (select 1 from participants where trip_id = packing_items.trip_id and user_id = auth.uid())
  );
