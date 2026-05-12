alter table packing_items
  add column if not exists scope text default 'shared'
    check (scope in ('shared','personal'));

create index if not exists packing_items_scope_idx
  on packing_items (trip_id, scope, category) where deleted_at is null;
