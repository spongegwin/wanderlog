drop policy if exists "trip members delete resources" on resources;
create policy "trip members delete resources"
  on resources for delete using (
    exists (select 1 from participants where trip_id = resources.trip_id and user_id = auth.uid())
  );
