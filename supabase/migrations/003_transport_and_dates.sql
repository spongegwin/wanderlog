-- Real calendar date for blocks (drives chronological sort)
alter table itinerary_blocks
  add column if not exists date date;

-- Transport-specific fields
alter table itinerary_blocks
  add column if not exists transport_mode text
    check (transport_mode in ('drive','ferry','flight','transit','walk','other')),
  add column if not exists from_location text,
  add column if not exists to_location text,
  add column if not exists distance_mi numeric,
  add column if not exists duration_min int;

create index if not exists itinerary_blocks_date_idx
  on itinerary_blocks (trip_id, date, sort_order);
