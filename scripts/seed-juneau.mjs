import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in your environment.");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Get the first user (you)
const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
if (usersError || !users.length) {
  console.error("No users found — make sure you've signed in first.", usersError);
  process.exit(1);
}
const user = users[0];
console.log(`Seeding for user: ${user.email}`);

// Create the trip
const { data: trip, error: tripError } = await supabase
  .from("trips")
  .insert({
    name: "Seven Days in Juneau",
    destination: "Southeast Alaska",
    status: "upcoming",
    start_date: "2026-07-12",
    end_date: "2026-07-18",
    essence: "Seven days chasing glaciers, whales, and halibut in the Last Frontier.",
    created_by: user.id,
  })
  .select()
  .single();

if (tripError || !trip) {
  console.error("Failed to create trip:", tripError);
  process.exit(1);
}
console.log(`Created trip: ${trip.id}`);

// Add organizer as participant
await supabase.from("participants").insert({
  trip_id: trip.id,
  user_id: user.id,
  name: user.user_metadata?.full_name ?? user.email,
  role: "organizer",
  color: "#c45c2e",
});

// Itinerary blocks
const blocks = [
  // Day 1
  {
    type: "flight", icon: "✈️", title: "Fly to Juneau",
    subtitle: "SEA → JNU · Alaska Airlines",
    status: "confirmed", day_label: "Day 1 — Sat Jul 12",
    booking_conf: "AXKQ24", sort_order: 1,
  },
  {
    type: "stay", icon: "🏨", title: "Silverbow Inn",
    subtitle: "Downtown Juneau · 7 nights",
    status: "confirmed", day_label: "Day 1 — Sat Jul 12",
    booking_conf: "SB-88214", sort_order: 2,
  },
  {
    type: "meal", icon: "🍽️", title: "Dinner at Tracy's King Crab Shack",
    subtitle: "Fresh Dungeness & king crab on the dock",
    status: "suggested", day_label: "Day 1 — Sat Jul 12", sort_order: 3,
  },

  // Day 2
  {
    type: "hike", icon: "🥾", title: "Mendenhall Glacier + Nugget Falls",
    subtitle: "Walk to the glacier face and Nugget Falls viewpoint",
    status: "confirmed", day_label: "Day 2 — Sun Jul 13",
    hike_start: "Mendenhall Visitor Center",
    hike_end: "Nugget Falls",
    hike_distance: "3.2 mi round trip",
    hike_elev_gain: "150 ft",
    hike_est_hours: "2–3 hrs",
    hike_difficulty: "easy",
    weather_note: "Bring rain gear — microclimate around the glacier",
    sort_order: 4,
  },
  {
    type: "activity", icon: "🏔️", title: "Glacier kayaking",
    subtitle: "Paddle close to the Mendenhall ice face",
    status: "suggested", day_label: "Day 2 — Sun Jul 13", sort_order: 5,
    cost_amount: 120, cost_currency: "USD",
  },

  // Day 3
  {
    type: "activity", icon: "🐋", title: "Whale watching",
    subtitle: "Humpbacks in Stephens Passage · 4-hour boat tour",
    status: "confirmed", day_label: "Day 3 — Mon Jul 14",
    booking_conf: "WW-4421", sort_order: 6,
    cost_amount: 175, cost_currency: "USD",
  },
  {
    type: "meal", icon: "🍺", title: "Alaskan Brewing Co. tasting room",
    subtitle: "Local craft beers, free tour included",
    status: "suggested", day_label: "Day 3 — Mon Jul 14", sort_order: 7,
  },

  // Day 4
  {
    type: "activity", icon: "🎣", title: "Halibut fishing charter",
    subtitle: "Full-day deep sea fishing · Icy Strait Charters",
    status: "confirmed", day_label: "Day 4 — Tue Jul 15",
    booking_conf: "ISC-7723", sort_order: 8,
    cost_amount: 280, cost_currency: "USD",
  },

  // Day 5
  {
    type: "activity", icon: "🚣", title: "Sea kayaking on Auke Bay",
    subtitle: "Half-day guided paddle through sheltered coves",
    status: "suggested", day_label: "Day 5 — Wed Jul 16",
    cost_amount: 95, cost_currency: "USD", sort_order: 9,
  },
  {
    type: "hike", icon: "🥾", title: "Perseverance Trail",
    subtitle: "Historic mining trail through rainforest & granite canyon",
    status: "idea", day_label: "Day 5 — Wed Jul 16",
    hike_start: "Basin Road Trailhead",
    hike_end: "Perseverance Mine ruins",
    hike_distance: "6.8 mi round trip",
    hike_elev_gain: "900 ft",
    hike_est_hours: "3–4 hrs",
    hike_difficulty: "moderate",
    sort_order: 10,
  },

  // Day 6
  {
    type: "activity", icon: "🚡", title: "Mt. Roberts Tramway",
    subtitle: "Ride to 1,760 ft — panoramic views of Gastineau Channel",
    status: "suggested", day_label: "Day 6 — Thu Jul 17",
    cost_amount: 35, cost_currency: "USD", sort_order: 11,
  },
  {
    type: "activity", icon: "🐻", title: "Bear viewing — Pack Creek",
    subtitle: "Float plane to Admiralty Island to watch brown bears",
    status: "idea", day_label: "Day 6 — Thu Jul 17",
    cost_amount: 450, cost_currency: "USD", sort_order: 12,
  },
  {
    type: "meal", icon: "🍽️", title: "Farewell dinner at The Rookery",
    subtitle: "Upscale farm-to-table, great Alaska king salmon",
    status: "idea", day_label: "Day 6 — Thu Jul 17", sort_order: 13,
  },

  // Day 7
  {
    type: "flight", icon: "✈️", title: "Fly home",
    subtitle: "JNU → SEA · Alaska Airlines",
    status: "confirmed", day_label: "Day 7 — Fri Jul 18",
    booking_conf: "AXKQ25", sort_order: 14,
  },
];

const { error: blocksError } = await supabase.from("itinerary_blocks").insert(
  blocks.map((b) => ({ ...b, trip_id: trip.id, added_by: user.id }))
);

if (blocksError) {
  console.error("Failed to insert blocks:", blocksError);
  process.exit(1);
}

console.log(`✓ Inserted ${blocks.length} blocks`);
console.log(`\nTrip URL: http://localhost:3000/trips/${trip.id}`);
