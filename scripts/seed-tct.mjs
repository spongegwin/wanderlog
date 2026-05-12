import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in your environment.");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
if (usersError || !users.length) {
  console.error("No users found.", usersError);
  process.exit(1);
}

const gwin = users.find((u) => u.email === "gwinzhou@gmail.com") ?? users[0];
console.log(`Seeding TCT trip as: ${gwin.email}`);

// Delete existing TCT trip (clean reseed)
const { data: existing } = await supabase
  .from("trips")
  .select("id")
  .eq("name", "Trans-Catalina Trail");
if (existing?.length) {
  await supabase.from("trips").delete().in("id", existing.map((t) => t.id));
  console.log(`Deleted ${existing.length} existing TCT trip(s)`);
}

// ─── TRIP ─────────────────────────────────────────────────────────────────────

const { data: trip, error: tripError } = await supabase
  .from("trips")
  .insert({
    name: "Trans-Catalina Trail",
    destination: "Catalina Island, CA",
    status: "upcoming",
    start_date: "2026-05-18",
    end_date: "2026-05-20",
    essence: "38 miles of ridgeline trail across the island. Bison, foxes, ocean views.",
    photo_1_url: "https://images.unsplash.com/photo-1593351415075-3bac9f45c877?w=800&q=80",
    photo_2_url: "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=400&q=80",
    invite_token: "tct26g",
    created_by: gwin.id,
  })
  .select()
  .single();

if (tripError || !trip) {
  console.error("Failed to create trip:", tripError);
  process.exit(1);
}
console.log(`Created trip: ${trip.id}`);

// ─── PARTICIPANTS ──────────────────────────────────────────────────────────────

await supabase.from("participants").insert([
  { trip_id: trip.id, user_id: gwin.id, name: "Gwin", role: "organizer", color: "#6366f1" },
  { trip_id: trip.id, user_id: null,    name: "Albert", role: "confirmed", color: "#10b981" },
  { trip_id: trip.id, user_id: null,    name: "Eric",   role: "confirmed", color: "#f59e0b" },
]);

// ─── WAYPOINTS WITH GPS ───────────────────────────────────────────────────────

const day1Waypoints = [
  { location: "Avalon Ferry Terminal", elevation_ft: 10, total_dist_mi: 0, time: "07:30", lat: 33.3437, lon: -118.3284, notes: "Meet at ferry dock. Stock up at Vons before leaving." },
  { location: "Avalon Canyon Trailhead", elevation_ft: 120, gain_ft: 110, dist_mi: 0.8, total_dist_mi: 0.8, duration: "0:20", time: "07:50", lat: 33.3487, lon: -118.3369 },
  { location: "Stage Road Junction", elevation_ft: 1100, gain_ft: 980, dist_mi: 2.5, total_dist_mi: 3.3, duration: "1:20", time: "09:10", lat: 33.3764, lon: -118.3798, escape: "Turn back to Avalon if needed (3.3 mi return)" },
  { location: "Morning Break", is_break: true, duration: "0:15", time: "09:25", lat: 33.3764, lon: -118.3798 },
  { location: "Haypress Reservoir", elevation_ft: 1480, gain_ft: 380, dist_mi: 1.8, total_dist_mi: 5.1, duration: "0:55", time: "10:20", lat: 33.3886, lon: -118.3953 },
  { location: "Middle Ranch Junction", elevation_ft: 1280, gain_ft: 40, loss_ft: 240, dist_mi: 1.6, total_dist_mi: 6.7, duration: "0:45", time: "11:05", lat: 33.4047, lon: -118.4089, escape: "Descend to Middle Ranch (2 mi) for emergency evac" },
  { location: "Lunch Break", is_break: true, duration: "0:30", time: "11:35", lat: 33.4047, lon: -118.4089 },
  { location: "Airport in the Sky", elevation_ft: 1602, gain_ft: 380, dist_mi: 2.8, total_dist_mi: 9.5, duration: "1:20", time: "13:25", lat: 33.4279, lon: -118.4121, notes: "Visitor center open. Water, bathrooms, buffalo burgers." },
  { location: "Black Jack Junction", elevation_ft: 1620, gain_ft: 120, dist_mi: 1.2, total_dist_mi: 10.7, duration: "0:35", time: "14:00", lat: 33.4401, lon: -118.4264 },
  { location: "Black Jack Spring", elevation_ft: 1400, gain_ft: 40, loss_ft: 260, dist_mi: 0.9, total_dist_mi: 11.6, duration: "0:25", time: "14:25", lat: 33.4432, lon: -118.4297, notes: "Last reliable water before camp." },
  { location: "Blackjack Campsite", elevation_ft: 1620, gain_ft: 220, dist_mi: 1.5, total_dist_mi: 13.1, duration: "0:45", time: "15:10", lat: 33.4467, lon: -118.4386 },
];

const day2Waypoints = [
  { location: "Blackjack Campsite", elevation_ft: 1620, total_dist_mi: 0, time: "07:00", lat: 33.4467, lon: -118.4386 },
  { location: "West Peak Trail", elevation_ft: 2069, gain_ft: 449, dist_mi: 1.4, total_dist_mi: 1.4, duration: "0:45", time: "07:45", lat: 33.4532, lon: -118.4543, notes: "Highest point on TCT. 360° island views on clear days." },
  { location: "Morning Break", is_break: true, duration: "0:15", time: "08:00", lat: 33.4532, lon: -118.4543 },
  { location: "Eagle's Nest Camp Junction", elevation_ft: 1350, loss_ft: 719, dist_mi: 2.1, total_dist_mi: 3.5, duration: "0:55", time: "08:55", lat: 33.4387, lon: -118.4678, escape: "Eagle's Nest Camp 0.2 mi off trail (emergency shelter)" },
  { location: "Little Harbor", elevation_ft: 10, loss_ft: 1340, dist_mi: 3.9, total_dist_mi: 7.4, duration: "1:40", time: "10:35", lat: 33.4142, lon: -118.4681, notes: "Beach access. Water at campground spigot." },
  { location: "Lunch Break at Little Harbor", is_break: true, duration: "0:40", time: "11:15", lat: 33.4142, lon: -118.4681 },
  { location: "Shark Harbor", elevation_ft: 20, dist_mi: 0.4, total_dist_mi: 7.8, duration: "0:10", time: "12:05", lat: 33.4103, lon: -118.4715 },
  { location: "Empire Landing Road", elevation_ft: 620, gain_ft: 600, dist_mi: 2.2, total_dist_mi: 10.0, duration: "1:05", time: "13:10", lat: 33.4234, lon: -118.4876, escape: "Empire Landing beach 0.5 mi down (boat pickup possible)" },
  { location: "Afternoon Break", is_break: true, duration: "0:20", time: "13:30", lat: 33.4234, lon: -118.4876 },
  { location: "Isthmus Ridge", elevation_ft: 1020, gain_ft: 400, dist_mi: 2.5, total_dist_mi: 12.5, duration: "1:10", time: "14:40", lat: 33.4312, lon: -118.4934 },
  { location: "Two Harbors", elevation_ft: 10, loss_ft: 1010, dist_mi: 3.0, total_dist_mi: 15.5, duration: "1:05", time: "15:45", lat: 33.4424, lon: -118.4981, notes: "Harbor Store, Banning House Lodge bar, El Encanto restaurant." },
];

// ─── BLOCKS ───────────────────────────────────────────────────────────────────

const blocks = [
  {
    trip_id: trip.id,
    type: "hike",
    icon: "🥾",
    title: "Avalon → Blackjack Campsite",
    subtitle: "The hardest day — big climb out of Avalon, airport resupply, finish at Blackjack.",
    status: "confirmed",
    day_label: "Mon May 18",
    sort_order: 1,
    hike_start: "Avalon Ferry Terminal",
    hike_start_elev: "10 ft",
    hike_end: "Blackjack Campsite",
    hike_end_elev: "1,620 ft",
    hike_distance: "13.1 mi",
    hike_elev_gain: "3,400 ft",
    hike_est_hours: "6–7 hrs",
    hike_difficulty: "strenuous",
    hike_waypoints: day1Waypoints,
    added_by: gwin.id,
  },
  {
    trip_id: trip.id,
    type: "stay",
    icon: "🏕️",
    title: "Blackjack Campsite",
    subtitle: "Hilltop camp at 1,620 ft — dark skies, no light pollution.",
    status: "confirmed",
    day_label: "Mon May 18 night",
    sort_order: 2,
    booking_details: "Permit held by Albert · Firewood booked · $15/person/night",
    added_by: gwin.id,
  },
  {
    trip_id: trip.id,
    type: "hike",
    icon: "🥾",
    title: "Blackjack → Two Harbors",
    subtitle: "Summit West Peak, descend through Little Harbor beach, finish at the isthmus.",
    status: "confirmed",
    day_label: "Tue May 19",
    sort_order: 3,
    hike_start: "Blackjack Campsite",
    hike_start_elev: "1,620 ft",
    hike_end: "Two Harbors",
    hike_end_elev: "10 ft",
    hike_distance: "15.5 mi",
    hike_elev_gain: "3,100 ft",
    hike_est_hours: "7–8 hrs",
    hike_difficulty: "strenuous",
    hike_waypoints: day2Waypoints,
    added_by: gwin.id,
  },
  {
    trip_id: trip.id,
    type: "stay",
    icon: "🏕️",
    title: "Two Harbors Campsite",
    subtitle: "Beachside camp with harbor views. Shower tokens at Harbor Store.",
    status: "confirmed",
    day_label: "Tue May 19 night",
    sort_order: 4,
    booking_details: "Permit held by Albert · Firewood booked · $15/person/night",
    added_by: gwin.id,
  },
  {
    trip_id: trip.id,
    type: "hike",
    icon: "🥾",
    title: "Two Harbors → Parsons Landing (or ferry back)",
    subtitle: "Optional extension to Parsons Landing, or catch the ferry from Two Harbors back to Long Beach.",
    status: "idea",
    day_label: "Wed May 20",
    sort_order: 5,
    hike_start: "Two Harbors",
    hike_end: "Parsons Landing",
    hike_distance: "7.0 mi",
    hike_elev_gain: "1,200 ft",
    hike_est_hours: "3–4 hrs",
    hike_difficulty: "moderate",
    hike_has_variant: true,
    hike_variant_note: "Skip the extension and catch the 10:30am ferry from Two Harbors instead.",
    added_by: gwin.id,
  },
];

const { error: blocksError } = await supabase.from("itinerary_blocks").insert(blocks);
if (blocksError) {
  console.error("Blocks error:", blocksError);
  process.exit(1);
}

console.log(`\n✓ Trans-Catalina Trail trip seeded with GPS coordinates.`);
console.log(`  Trip ID: ${trip.id}`);
console.log(`  URL: http://localhost:3000/trips/${trip.id}`);
