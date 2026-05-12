-- Allow trip members to add unclaimed (user_id IS NULL) participant rows.
--
-- The existing INSERT policy "authenticated users can join trips"
-- requires (auth.uid() = user_id), which blocks adding a placeholder
-- row whose user_id is NULL. That made TripSettingsModal's "Add by name"
-- flow silently fail under RLS. This policy fills the gap for unclaimed
-- slots while leaving the self-join path untouched.

drop policy if exists "trip members can add unclaimed participants" on public.participants;
create policy "trip members can add unclaimed participants"
  on public.participants for insert with check (
    user_id is null
    and public.auth_user_is_trip_member(trip_id)
  );
