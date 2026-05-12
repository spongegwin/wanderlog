import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in your environment.");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Get logged-in user (Gwin)
const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
if (usersError || !users.length) {
  console.error("No users found — sign in first.", usersError);
  process.exit(1);
}
const gwin = users[0];
console.log(`Seeding as: ${gwin.email}`);

// ─── TRIPS ────────────────────────────────────────────────────────────────────

const tripsData = [
  {
    name: "North of Everything",
    destination: "Juneau, Alaska",
    status: "upcoming",
    start_date: "2026-08-14",
    end_date: "2026-08-18",
    essence: "Glacier hikes, whale watches, and zero cell service.",
    photo_1_url: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=800&q=80",
    photo_2_url: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=400&q=80",
    invite_token: "xk9p2m",
    created_by: gwin.id,
  },
  {
    name: "Tour du Mont Blanc",
    destination: "France · Italy · Switzerland",
    status: "upcoming",
    start_date: "2026-07-27",
    end_date: "2026-08-08",
    essence: "10 days, 3 countries, 113 miles, one loop around the highest peak in the Alps.",
    photo_1_url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
    photo_2_url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&q=80",
    invite_token: "tmb26x",
    created_by: gwin.id,
  },
];

const { data: trips, error: tripsError } = await supabase
  .from("trips")
  .insert(tripsData)
  .select();

if (tripsError || !trips) {
  console.error("Failed to insert trips:", tripsError);
  process.exit(1);
}
console.log(`✓ Created ${trips.length} trips`);

const t001 = trips.find((t) => t.name === "North of Everything");
const t005 = trips.find((t) => t.name === "Tour du Mont Blanc");

// ─── PARTICIPANTS ─────────────────────────────────────────────────────────────

const participants001 = [
  { trip_id: t001.id, user_id: gwin.id, name: "Gwin",  role: "organizer", color: "#c45c2e" },
  { trip_id: t001.id, user_id: null,    name: "Eric",  role: "confirmed",  color: "#3a6b8a" },
  { trip_id: t001.id, user_id: null,    name: "Sam",   role: "confirmed",  color: "#4a7c59" },
  { trip_id: t001.id, user_id: null,    name: "Jamie", role: "confirmed",  color: "#8a5a3a" },
  { trip_id: t001.id, user_id: null,    name: "Priya", role: "confirmed",  color: "#6b3a8a" },
];

const participants005 = [
  { trip_id: t005.id, user_id: gwin.id, name: "Gwin",    role: "organizer", color: "#c45c2e" },
  { trip_id: t005.id, user_id: null,    name: "Eric",    role: "confirmed",  color: "#3a6b8a" },
  { trip_id: t005.id, user_id: null,    name: "David",   role: "confirmed",  color: "#4a7c59" },
  { trip_id: t005.id, user_id: null,    name: "Wenting", role: "confirmed",  color: "#8a5a3a" },
];

await supabase.from("participants").insert([
  ...participants001,
  ...participants005,
]);
console.log("✓ Created participants");

// ─── ITINERARY BLOCKS — TRIP 001 ─────────────────────────────────────────────

const blocks001 = [
  {
    type: "flight", icon: "✈️",
    title: "Alaska Airlines 412",
    subtitle: "SFO → JNU · Departs 7:10am · Arrives 11:40am",
    status: "confirmed", day_label: "Thu Aug 14", sort_order: 1,
    booking_conf: "ALASK-9821",
    booking_details: "Group booking · 5 seats confirmed",
    booking_link: "https://alaskaair.com",
  },
  {
    type: "stay", icon: "🏠",
    title: "Pearson's Pond Luxury Inn",
    subtitle: "Check-in Aug 14 3pm · Check-out Aug 18 11am · 3 rooms",
    status: "confirmed", day_label: "Thu Aug 14", sort_order: 2,
    booking_conf: "PP-44821",
    booking_details: "3 rooms · $189/night · Free cancellation until Aug 7",
    booking_link: "https://pearsonspond.com",
    cancel_deadline: "2026-08-07",
    cost_amount: 756, cost_currency: "USD",
  },
  {
    type: "activity", icon: "⛰️",
    title: "Mendenhall Glacier hike",
    subtitle: "East Glacier Trail · Morning · ~4hrs · Moderate",
    status: "confirmed", day_label: "Fri Aug 15", sort_order: 3,
  },
  {
    type: "meal", icon: "🦀",
    title: "Tracy's King Crab Shack",
    subtitle: "Dinner · 7:00pm · Waterfront · Party of 5",
    status: "confirmed", day_label: "Fri Aug 15", sort_order: 4,
    booking_conf: "RES-7734",
    booking_details: "Party of 5 · 7:00pm · Waterfront seating",
  },
  {
    type: "activity", icon: "🐋",
    title: "Whale watching tour",
    subtitle: "Orca Enterprises · 8am · 3hrs · Small boat",
    status: "suggested", day_label: "Sat Aug 16", sort_order: 5,
    cost_amount: 200, cost_currency: "USD",
  },
  {
    type: "activity", icon: "🛩️",
    title: "Floatplane over the icefield",
    subtitle: "Era Aviation · 1hr scenic flight · ~$200pp",
    status: "idea", day_label: "Sun Aug 17", sort_order: 6,
    cost_amount: 200, cost_currency: "USD",
  },
  {
    type: "flight", icon: "✈️",
    title: "Alaska Airlines 415",
    subtitle: "JNU → SFO · Departs 4:50pm · Arrives 9:15pm",
    status: "confirmed", day_label: "Mon Aug 18", sort_order: 7,
    booking_conf: "ALASK-9822",
    booking_details: "Group booking · 5 seats confirmed",
    booking_link: "https://alaskaair.com",
  },
];

const { data: insertedBlocks001, error: b001err } = await supabase
  .from("itinerary_blocks")
  .insert(blocks001.map((b) => ({ ...b, trip_id: t001.id, added_by: gwin.id })))
  .select();

if (b001err) { console.error("blocks001 error:", b001err); process.exit(1); }
console.log(`✓ Created ${insertedBlocks001.length} blocks for North of Everything`);

// Map block titles to IDs for comments/reactions/bookings
const blkById = {};
const blkByTitle = {};
for (const b of insertedBlocks001) {
  blkByTitle[b.title] = b.id;
}
const blk001 = blkByTitle["Alaska Airlines 412"];
const blk002 = blkByTitle["Pearson's Pond Luxury Inn"];
const blk003 = blkByTitle["Mendenhall Glacier hike"];
const blk004 = blkByTitle["Tracy's King Crab Shack"];
const blk005 = blkByTitle["Whale watching tour"];
const blk006 = blkByTitle["Floatplane over the icefield"];

// ─── ITINERARY BLOCKS — TRIP 005 ─────────────────────────────────────────────

const elevProfiles = {
  "Les Houches → Auberge du Truc":         [0.15, 0.25, 0.45, 0.62, 0.78, 0.92, 1.0, 0.88, 0.72],
  "Auberge du Truc → Bourg Saint Maurice": [0.35, 0.55, 0.75, 0.92, 1.0, 0.85, 0.70, 0.50, 0.30, 0.15, 0.08],
  "Bourg Saint Maurice → Courmayeur":      [0.08, 0.25, 0.55, 0.80, 1.0, 0.95, 0.85, 0.70, 0.55, 0.40, 0.28],
  "Courmayeur → Refugio Elena":            [0.28, 0.42, 0.60, 0.78, 0.90, 1.0, 0.92, 0.80, 0.65],
  "Champex-Lac → Le Tour / Argentière":    [0.20, 0.38, 0.55, 0.72, 0.88, 1.0, 0.92, 0.78, 0.60, 0.42, 0.30],
};

const blocks005 = [
  {
    type: "flight", icon: "✈️",
    title: "SFO → Geneva",
    subtitle: "Delta · Mon Jul 27 evening · Arrives Tue Jul 28 afternoon",
    status: "confirmed", day_label: "Mon Jul 27", sort_order: 1,
    booking_conf: "DL-BOOKED",
    booking_details: "David booked · ARR GVA 13:40 Jul 28",
  },
  {
    type: "stay", icon: "🏠",
    title: "Chamonix Airbnb",
    subtitle: "Tue–Thu Jul 28–30 · Rest days before trail",
    status: "confirmed", day_label: "Tue Jul 28", sort_order: 2,
    booking_conf: "AIRBNB-CHX",
    booking_details: "Booked 4x · $634.69 · Cancellation ok Jun 28",
    cancel_deadline: "2026-06-28",
    cost_amount: 634.69, cost_currency: "USD",
  },
  {
    type: "hike", icon: "⛰️",
    title: "Les Houches → Auberge du Truc",
    subtitle: "Day 1 · Via Col de Tricot variant",
    status: "confirmed", day_label: "Thu Jul 30", sort_order: 3,
    hike_start: "Les Houches", hike_start_elev: "1,007m",
    hike_end: "Auberge du Truc", hike_end_elev: "1,720m",
    hike_distance: "9.2 mi", hike_elev_gain: "4,600 ft",
    hike_est_hours: "~5–6 hrs", hike_difficulty: "moderate",
    hike_has_variant: true,
    hike_variant_note: "Col de Tricot variant — absolutely worth it in good weather. Insanely beautiful. Get the house tart at Refuge de Miage for lunch.",
    hike_elev_profile: [0.15, 0.25, 0.45, 0.62, 0.78, 0.92, 1.0, 0.88, 0.72],
    weather_high: "24°C / 75°F", weather_low: "12°C / 54°F",
    weather_note: "Warm valley start; lush and humid. Good conditions expected.",
  },
  {
    type: "stay", icon: "🏠",
    title: "Auberge du Truc",
    subtitle: "Night 1 · Half board · Dinner + packed lunch",
    status: "confirmed", day_label: "Thu Jul 30", sort_order: 4,
    booking_conf: "ADT-2026",
    booking_details: "Booked 2x; Eric booked separate; Wenting booked separate · €123.60 · Half deposit paid",
    cost_amount: 123.60, cost_currency: "EUR",
  },
  {
    type: "hike", icon: "⛰️",
    title: "Auberge du Truc → Bourg Saint Maurice",
    subtitle: "Day 2 · Longest climb of the first half",
    status: "confirmed", day_label: "Fri Jul 31", sort_order: 5,
    hike_start: "Auberge du Truc", hike_start_elev: "1,720m",
    hike_end: "Bourg Saint Maurice", hike_end_elev: "840m",
    hike_distance: "14 mi", hike_elev_gain: "4,300 ft",
    hike_est_hours: "~7–8 hrs", hike_difficulty: "strenuous",
    hike_has_variant: false,
    hike_elev_profile: [0.35, 0.55, 0.75, 0.92, 1.0, 0.85, 0.70, 0.50, 0.30, 0.15, 0.08],
    weather_high: "20°C / 68°F", weather_low: "8°C / 46°F",
    weather_note: "Cold air traps in this tight valley at night. Pack layers for the descent.",
  },
  {
    type: "transport", icon: "🚌",
    title: "Shuttle — Les Chapieux → Bourg Saint Maurice",
    subtitle: "Required to rejoin trail after Les Chapieux · Morning departure",
    status: "idea", day_label: "Fri Jul 31", sort_order: 6,
    booking_details: "Need to book — required to continue route",
  },
  {
    type: "stay", icon: "🏠",
    title: "L'Angival",
    subtitle: "Night 2 · Bourg Saint Maurice · Stay + breakfast",
    status: "confirmed", day_label: "Fri Jul 31", sort_order: 7,
    booking_conf: "ANG-2026",
    booking_details: "Booked 3x · Wenting booked separate · €196 · Cancellation ok 7 days prior",
    cancel_deadline: "2026-07-24",
    cost_amount: 196, cost_currency: "EUR",
  },
  {
    type: "hike", icon: "⛰️",
    title: "Bourg Saint Maurice → Courmayeur",
    subtitle: "Day 3 · Crosses into Italy · Longest day",
    status: "confirmed", day_label: "Sat Aug 1", sort_order: 8,
    hike_start: "Bourg Saint Maurice", hike_start_elev: "840m",
    hike_end: "Courmayeur", hike_end_elev: "1,224m",
    hike_distance: "18.5 mi", hike_elev_gain: "5,000 ft",
    hike_est_hours: "~9–10 hrs", hike_difficulty: "strenuous",
    hike_has_variant: false,
    hike_elev_profile: [0.08, 0.25, 0.55, 0.80, 1.0, 0.95, 0.85, 0.70, 0.55, 0.40, 0.28],
    weather_high: "15°C / 59°F", weather_low: "4°C / 39°F",
    weather_note: "Perched by a glacier; expect a biting morning chill. Dress in layers.",
  },
  {
    type: "rest", icon: "☕",
    title: "Rest day — Courmayeur",
    subtitle: "Day 4 · Italy · Recovery + exploration",
    status: "confirmed", day_label: "Sun Aug 2", sort_order: 9,
    booking_details: "Spa, restaurants, cable cars · Usually the hottest stop — great for gelato",
    weather_high: "27°C / 81°F", weather_low: "14°C / 57°F",
    weather_note: "Usually the hottest stop on the route.",
  },
  {
    type: "hike", icon: "⛰️",
    title: "Courmayeur → Refugio Elena",
    subtitle: "Day 5 · High balcony path · Very exposed",
    status: "confirmed", day_label: "Mon Aug 3", sort_order: 10,
    hike_start: "Courmayeur", hike_start_elev: "1,224m",
    hike_end: "Refugio Elena", hike_end_elev: "2,062m",
    hike_distance: "12.5 mi", hike_elev_gain: "4,500 ft",
    hike_est_hours: "~6–7 hrs", hike_difficulty: "strenuous",
    hike_has_variant: false,
    hike_elev_profile: [0.28, 0.42, 0.60, 0.78, 0.90, 1.0, 0.92, 0.80, 0.65],
    weather_high: "19°C / 66°F", weather_low: "7°C / 45°F",
    weather_note: "High balcony path; very exposed to afternoon sun. Start early.",
  },
  {
    type: "hike", icon: "⛰️",
    title: "Refugio Elena → Champex-Lac",
    subtitle: "Day 6 · Crosses into Switzerland",
    status: "confirmed", day_label: "Tue Aug 4", sort_order: 11,
    hike_start: "Refugio Elena", hike_start_elev: "2,062m",
    hike_end: "Champex-Lac", hike_end_elev: "1,466m",
    hike_distance: "15.7 mi", hike_elev_gain: "3,000 ft",
    hike_est_hours: "~7–8 hrs", hike_difficulty: "moderate",
    hike_has_variant: false,
    weather_high: "21°C / 70°F", weather_low: "9°C / 48°F",
    weather_note: "Swiss side feels fresher and often greener.",
  },
  {
    type: "hike", icon: "⛰️",
    title: "Champex-Lac → Le Tour / Argentière",
    subtitle: "Day 7 · Switzerland → France · Second longest day",
    status: "confirmed", day_label: "Wed Aug 5", sort_order: 12,
    hike_start: "Champex-Lac", hike_start_elev: "1,466m",
    hike_end: "Argentière", hike_end_elev: "1,252m",
    hike_distance: "17.7 mi", hike_elev_gain: "5,900 ft",
    hike_est_hours: "~8–9 hrs", hike_difficulty: "strenuous",
    hike_has_variant: false,
    hike_elev_profile: [0.20, 0.38, 0.55, 0.72, 0.88, 1.0, 0.92, 0.78, 0.60, 0.42, 0.30],
    weather_high: "23°C / 73°F", weather_low: "11°C / 52°F",
    weather_note: "Comfortable; lake breeze can be cooling in the morning.",
  },
  {
    type: "hike", icon: "⛰️",
    title: "Le Tour / Argentière → Les Houches",
    subtitle: "Day 8 · Final stage · Return to Chamonix by bus",
    status: "idea", day_label: "Thu Aug 6", sort_order: 13,
    hike_start: "Le Tour / Argentière", hike_start_elev: "1,252m",
    hike_end: "Les Houches", hike_end_elev: "1,007m",
    hike_distance: "15.1 mi", hike_elev_gain: "4,700 ft",
    hike_est_hours: "~7–8 hrs", hike_difficulty: "strenuous",
    hike_has_variant: true,
    hike_variant_note: "Alt early stop in La Flégère area — take cable car down to Chamonix. Last bus from Les Houches ~6pm.",
    weather_high: "26°C / 79°F", weather_low: "13°C / 57°F",
    weather_note: "Descending into the heat of the Chamonix valley.",
  },
];

const { data: insertedBlocks005, error: b005err } = await supabase
  .from("itinerary_blocks")
  .insert(blocks005.map((b) => ({ ...b, trip_id: t005.id, added_by: gwin.id })))
  .select();

if (b005err) { console.error("blocks005 error:", b005err); process.exit(1); }
console.log(`✓ Created ${insertedBlocks005.length} blocks for Tour du Mont Blanc`);

// ─── COMMENTS — TRIP 001 ─────────────────────────────────────────────────────

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

const comments = [
  { block_id: blk001, author_name: "Eric",  author_color: "#3a6b8a", text: "Already checked in — seat 12A!", created_at: daysAgo(2) },
  { block_id: blk001, author_name: "Sam",   author_color: "#4a7c59", text: "Same, 14B. See you at the gate.", created_at: daysAgo(1) },
  { block_id: blk001, author_name: "Priya", author_color: "#6b3a8a", text: "Meeting you all there — parking at SFO T2", created_at: daysAgo(1) },
  { block_id: blk002, author_name: "Priya", author_color: "#6b3a8a", text: "Looks so cozy! Right on the lake too.", created_at: daysAgo(3) },
  { block_id: blk002, author_name: "Gwin",  author_color: "#c45c2e", text: "Room assignments: Lakeside 1 → Gwin + Priya, Lakeside 2 → Eric + Sam, Garden → Jamie", created_at: daysAgo(3) },
  { block_id: blk002, author_name: "Jamie", author_color: "#8a5a3a", text: "Garden view for me, love it", created_at: daysAgo(2) },
  { block_id: blk003, author_name: "Jamie", author_color: "#8a5a3a", text: "East Glacier trail is supposed to be the best view — definitely this one.", created_at: daysAgo(7) },
  { block_id: blk003, author_name: "Gwin",  author_color: "#c45c2e", text: "Let's go early to beat the cruise ship crowds — 7am?", created_at: daysAgo(5) },
  { block_id: blk003, author_name: "Eric",  author_color: "#3a6b8a", text: "7am works! I'll grab coffee from the lodge before we head out.", created_at: daysAgo(5) },
  { block_id: blk003, author_name: "Sam",   author_color: "#4a7c59", text: "Pack layers — weather can flip fast up there", created_at: daysAgo(4) },
  { block_id: blk004, author_name: "Sam",   author_color: "#4a7c59", text: "Highly recommend — everyone says best crab in Juneau. Get the snow crab legs.", created_at: daysAgo(4) },
  { block_id: blk004, author_name: "Eric",  author_color: "#3a6b8a", text: "Already called ahead, they have waterfront spots for us", created_at: daysAgo(3) },
  { block_id: blk005, author_name: "Priya", author_color: "#6b3a8a", text: "Found a better operator — Orca Enterprises, 4.9 stars, smaller boats so you get closer.", created_at: daysAgo(3) },
  { block_id: blk005, author_name: "Gwin",  author_color: "#c45c2e", text: "Let's switch. Can you grab a booking link Priya?", created_at: daysAgo(2) },
  { block_id: blk005, author_name: "Priya", author_color: "#6b3a8a", text: "On it — will post the link here once I have it", created_at: daysAgo(2) },
  { block_id: blk005, author_name: "Eric",  author_color: "#3a6b8a", text: "If we go 8am we'd need to be up by 7 — is that ok after glacier day?", created_at: daysAgo(1) },
  { block_id: blk006, author_name: "Gwin",  author_color: "#c45c2e", text: "This looks absolutely unreal. Who's in?", created_at: daysAgo(5) },
  { block_id: blk006, author_name: "Jamie", author_color: "#8a5a3a", text: "100% in. This is a once in a lifetime thing.", created_at: daysAgo(5) },
  { block_id: blk006, author_name: "Sam",   author_color: "#4a7c59", text: "I'm a little nervous about small planes... can I think about it?", created_at: daysAgo(4) },
  { block_id: blk006, author_name: "Gwin",  author_color: "#c45c2e", text: "Of course! No pressure at all Sam.", created_at: daysAgo(4) },
];

const { error: commentsErr } = await supabase.from("comments").insert(
  comments.map((c) => ({ ...c, user_id: c.author_name === "Gwin" ? gwin.id : null }))
);
if (commentsErr) { console.error("comments error:", commentsErr); process.exit(1); }
console.log(`✓ Created ${comments.length} comments`);

// ─── REACTIONS — TRIP 001 ────────────────────────────────────────────────────

const reactions = [
  { block_id: blk001, emoji: "✓",  user_id: null, author: "Eric" },
  { block_id: blk001, emoji: "✓",  user_id: null, author: "Sam" },
  { block_id: blk001, emoji: "✓",  user_id: null, author: "Jamie" },
  { block_id: blk001, emoji: "✓",  user_id: null, author: "Priya" },
  { block_id: blk002, emoji: "❤️", user_id: gwin.id, author: "Gwin" },
  { block_id: blk002, emoji: "❤️", user_id: null, author: "Eric" },
  { block_id: blk002, emoji: "❤️", user_id: null, author: "Priya" },
  { block_id: blk003, emoji: "👍", user_id: gwin.id, author: "Gwin" },
  { block_id: blk003, emoji: "👍", user_id: null, author: "Eric" },
  { block_id: blk003, emoji: "👍", user_id: null, author: "Sam" },
  { block_id: blk003, emoji: "👍", user_id: null, author: "Jamie" },
  { block_id: blk003, emoji: "👍", user_id: null, author: "Priya" },
  { block_id: blk004, emoji: "❤️", user_id: gwin.id, author: "Gwin" },
  { block_id: blk004, emoji: "❤️", user_id: null, author: "Sam" },
  { block_id: blk004, emoji: "❤️", user_id: null, author: "Priya" },
  { block_id: blk004, emoji: "👍", user_id: null, author: "Eric" },
  { block_id: blk004, emoji: "👍", user_id: null, author: "Jamie" },
  { block_id: blk005, emoji: "👍", user_id: gwin.id, author: "Gwin" },
  { block_id: blk005, emoji: "👍", user_id: null, author: "Priya" },
  { block_id: blk005, emoji: "👍", user_id: null, author: "Sam" },
  { block_id: blk005, emoji: "❓", user_id: null, author: "Eric" },
  { block_id: blk006, emoji: "❤️", user_id: gwin.id, author: "Gwin" },
  { block_id: blk006, emoji: "❤️", user_id: null, author: "Eric" },
  { block_id: blk006, emoji: "❤️", user_id: null, author: "Jamie" },
];

// reactions table has unique(block_id, user_id, emoji) — use null user_id with unique fake ids won't work
// Insert only the ones with unique combos
const { error: reactionsErr } = await supabase.from("reactions").insert(
  reactions.map(({ block_id, emoji, user_id }) => ({ block_id, emoji, user_id }))
);
if (reactionsErr) { console.error("reactions error (may have dupes — ok):", reactionsErr.message); }
else console.log(`✓ Created ${reactions.length} reactions`);

// ─── BLOCK BOOKINGS — TRIP 001 (Pearson's Pond) ───────────────────────────────

const bookings = [
  { block_id: blk002, user_id: gwin.id, name: "Gwin",  conf_number: "PP-44821-A" },
  { block_id: blk002, user_id: null,    name: "Eric",  conf_number: "PP-44821-B" },
  { block_id: blk002, user_id: null,    name: "Sam",   conf_number: "PP-44821-B" },
  { block_id: blk002, user_id: null,    name: "Priya", conf_number: "PP-44821-A" },
  // Jamie has NOT confirmed — surfaces in Needs Action
];

const { error: bookingsErr } = await supabase.from("block_bookings").insert(bookings);
if (bookingsErr) { console.error("bookings error:", bookingsErr); }
else console.log(`✓ Created ${bookings.length} block bookings`);

// ─── RESOURCES — TRIP 005 ────────────────────────────────────────────────────

const resources = [
  { trip_id: t005.id, category: "trail_map",  title: "Komoot detailed route",             url: "https://www.komoot.com/collection/1255524",                           description: "Detailed route with milestones. Note: doesn't include Col de Tricot variant.", added_by: gwin.id },
  { trip_id: t005.id, category: "trail_map",  title: "Master TMB map with accommodations",url: "https://umap.openstreetmap.fr/fr/map/tour-du-mont-blanc-ccpmb_206457", description: "OpenStreetMap overlay with all refuge locations.", added_by: gwin.id },
  { trip_id: t005.id, category: "booking",    title: "TMB refuge availability calendar",  url: "https://www.montourdumontblanc.com/en/planning",                       description: "Master availability calendar — check before booking any refuge.", added_by: gwin.id },
  { trip_id: t005.id, category: "guide",      title: "Beginner's guide to the TMB",       url: "https://www.outsideonline.com/adventure-travel/destinations/europe/beginners-guide-tour-du-mont-blanc/", description: "Outside Online overview — good for first-timers.", added_by: gwin.id },
  { trip_id: t005.id, category: "community",  title: "r/TourDuMontBlanc wiki",            url: "https://www.reddit.com/r/TourDuMontBlanc/wiki/index/",                description: "Best community resource — answers almost every question.", added_by: gwin.id },
  { trip_id: t005.id, category: "community",  title: "9-day TMB guide with photos",       url: "https://www.reddit.com/r/CampingandHiking/comments/11pe99u/guide_to_hiking_tmb_in_9_days_pics_included/", description: "Detailed day-by-day breakdown with real photos.", added_by: gwin.id },
  { trip_id: t005.id, category: "guide",      title: "travelandsqueak TMB itinerary",     url: "https://travelandsqueak.com/tour-du-mont-blanc-itinerary/",           description: "Good pacing and accommodation tips.", added_by: gwin.id },
];

const { error: resourcesErr } = await supabase.from("resources").insert(resources);
if (resourcesErr) { console.error("resources error:", resourcesErr); }
else console.log(`✓ Created ${resources.length} resources`);

console.log("\n✅ Seed complete!");
console.log(`\nNorth of Everything: http://localhost:3000/trips/${t001.id}`);
console.log(`Tour du Mont Blanc:  http://localhost:3000/trips/${t005.id}`);
