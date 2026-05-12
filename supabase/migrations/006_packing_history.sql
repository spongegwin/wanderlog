alter table packing_items
  add column if not exists deleted_at timestamptz,
  add column if not exists sort_order int default 0;

create index if not exists packing_items_active_idx
  on packing_items (trip_id, deleted_at) where deleted_at is null;
