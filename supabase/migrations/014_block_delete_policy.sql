-- Allow trip members to delete itinerary blocks.
-- The initial migration covered select/insert/update for trip members
-- but never added a delete policy. As a result every delete from the UI
-- silently no-ops (RLS denies, Supabase returns 0 rows affected with no
-- error). Mirrors the same membership rule used by the other policies.

create policy "trip members can delete blocks"
  on public.itinerary_blocks for delete using (
    exists (
      select 1 from public.participants
      where trip_id = itinerary_blocks.trip_id
        and user_id = auth.uid()
    )
  );
