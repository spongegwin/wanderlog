-- Allow trip creator to delete their trip (FK cascade handles the rest)
drop policy if exists "trip creator can delete trips" on trips;
create policy "trip creator can delete trips"
  on trips for delete using (created_by = auth.uid());

-- Allow users to delete their own participant row, and organizers to delete any participant on their trip
drop policy if exists "users delete own participation" on participants;
create policy "users delete own participation"
  on participants for delete using (
    user_id = auth.uid()
    or exists (
      select 1 from trips where id = participants.trip_id and created_by = auth.uid()
    )
  );

-- Allow trip members to update participant rows on their trip (needed for "this is me" claim — sets user_id)
drop policy if exists "members claim participants" on participants;
create policy "members claim participants"
  on participants for update using (
    exists (
      select 1 from public.participants p
      where p.trip_id = participants.trip_id and p.user_id = auth.uid()
    )
  );
