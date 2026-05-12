alter table itinerary_blocks
  add column if not exists hike_waypoints jsonb;
