import type {
  Trip,
  Participant,
  ItineraryBlock,
  BlockBooking,
  PackingItem,
  Resource,
} from "./types";
import { assignColor } from "./utils";

export interface ExampleBundle {
  trip: Trip;
  participants: Participant[];
  itinerary_blocks: ItineraryBlock[];
  block_bookings: BlockBooking[];
  packing_items: PackingItem[];
  resources: Resource[];
}

const TRIP_ID = "example-trip-trans-catalina";
const FIXED_TS = "2026-04-01T12:00:00.000Z";

const AVERY = "example-user-avery";
const JORDAN = "example-user-jordan";
const SAM = "example-user-sam";

const trip: Trip = {
  id: TRIP_ID,
  name: "Trans-Catalina Trail",
  destination: "Catalina Island, CA",
  status: "upcoming",
  start_date: "2026-05-15",
  end_date: "2026-05-19",
  essence: "Four days. One ridge. Whatever the wind brings.",
  photo_1_url: null,
  photo_2_url: null,
  invite_token: null,
  created_by: AVERY,
  created_at: FIXED_TS,
};

const participants: Participant[] = [
  {
    id: "example-p-avery",
    trip_id: TRIP_ID,
    user_id: AVERY,
    name: "Avery",
    role: "organizer",
    color: assignColor(0),
    joined_at: FIXED_TS,
    invited_email: null,
  },
  {
    id: "example-p-jordan",
    trip_id: TRIP_ID,
    user_id: JORDAN,
    name: "Jordan",
    role: "confirmed",
    color: assignColor(1),
    joined_at: FIXED_TS,
    invited_email: null,
  },
  {
    id: "example-p-sam",
    trip_id: TRIP_ID,
    user_id: SAM,
    name: "Sam",
    role: "confirmed",
    color: assignColor(2),
    joined_at: FIXED_TS,
    invited_email: null,
  },
];

function block(partial: Partial<ItineraryBlock> & Pick<ItineraryBlock, "id" | "type" | "title" | "status" | "date" | "sort_order">): ItineraryBlock {
  return {
    trip_id: TRIP_ID,
    icon: null,
    subtitle: null,
    day_label: null,
    transport_mode: null,
    from_location: null,
    to_location: null,
    distance_mi: null,
    duration_min: null,
    booking_conf: null,
    booking_details: null,
    booking_link: null,
    cancel_deadline: null,
    hike_start: null,
    hike_start_elev: null,
    hike_end: null,
    hike_end_elev: null,
    hike_distance: null,
    hike_elev_gain: null,
    hike_est_hours: null,
    hike_difficulty: null,
    hike_has_variant: false,
    hike_variant_note: null,
    hike_elev_profile: null,
    hike_waypoints: null,
    weather_high: null,
    weather_low: null,
    weather_note: null,
    cost_amount: null,
    cost_currency: "USD",
    added_by: AVERY,
    created_at: FIXED_TS,
    ...partial,
  };
}

const itinerary_blocks: ItineraryBlock[] = [
  // Day 1 — Fri May 15: get to the island
  block({
    id: "example-b-1",
    type: "transport",
    title: "Catalina Express to Avalon",
    subtitle: "Long Beach terminal, 9:00 AM departure",
    status: "confirmed",
    date: "2026-05-15",
    sort_order: 0,
    transport_mode: "ferry",
    from_location: "Long Beach",
    to_location: "Avalon",
    duration_min: 60,
  }),
  block({
    id: "example-b-2",
    type: "stay",
    title: "Hermit Gulch Campground",
    subtitle: "Pre-trail night, walkable from Avalon",
    status: "confirmed",
    date: "2026-05-15",
    sort_order: 1,
  }),

  // Day 2 — Sat May 16: longest day on the trail
  block({
    id: "example-b-3",
    type: "hike",
    title: "Avalon → Black Jack",
    subtitle: "The climb out of Avalon is no joke. Pack 3L water minimum.",
    status: "confirmed",
    date: "2026-05-16",
    sort_order: 0,
    from_location: "Avalon",
    to_location: "Black Jack Campground",
    hike_distance: "15.8 mi",
    hike_elev_gain: "3200 ft",
    hike_est_hours: "8–10 hrs",
    hike_difficulty: "strenuous",
  }),
  block({
    id: "example-b-4",
    type: "meal",
    title: "Trail lunch at Haypress Reservoir",
    subtitle: "Shade + a flat rock. Bring extra electrolytes.",
    status: "suggested",
    date: "2026-05-16",
    sort_order: 1,
  }),
  block({
    id: "example-b-5",
    type: "stay",
    title: "Black Jack Campground",
    subtitle: "Site 4 reserved · highest campsite on the island",
    status: "confirmed",
    date: "2026-05-16",
    sort_order: 2,
  }),

  // Day 3 — Sun May 17: descent to the coast
  block({
    id: "example-b-6",
    type: "hike",
    title: "Black Jack → Little Harbor",
    subtitle: "Ridge views the whole way down to the cove.",
    status: "confirmed",
    date: "2026-05-17",
    sort_order: 0,
    from_location: "Black Jack",
    to_location: "Little Harbor",
    hike_distance: "10.2 mi",
    hike_elev_gain: "1700 ft",
    hike_est_hours: "5–6 hrs",
    hike_difficulty: "moderate",
  }),
  block({
    id: "example-b-7",
    type: "activity",
    title: "Sunset swim at Little Harbor cove",
    subtitle: "Tide pools on the south end after dinner.",
    status: "idea",
    date: "2026-05-17",
    sort_order: 1,
  }),
  block({
    id: "example-b-8",
    type: "stay",
    title: "Little Harbor Campground",
    subtitle: "Beachfront sites · grills + freshwater rinse",
    status: "confirmed",
    date: "2026-05-17",
    sort_order: 2,
  }),

  // Day 4 — Mon May 18: shortest day, easy roll into Two Harbors
  block({
    id: "example-b-9",
    type: "hike",
    title: "Little Harbor → Two Harbors",
    subtitle: "Climb to Silver Peak, then a long ridge walk.",
    status: "confirmed",
    date: "2026-05-18",
    sort_order: 0,
    from_location: "Little Harbor",
    to_location: "Two Harbors",
    hike_distance: "6.5 mi",
    hike_elev_gain: "1300 ft",
    hike_est_hours: "3–4 hrs",
    hike_difficulty: "moderate",
  }),
  block({
    id: "example-b-10",
    type: "meal",
    title: "Dinner at Harbor Reef Restaurant",
    subtitle: "Buffalo Milk cocktails, fresh fish. Cash + cards.",
    status: "suggested",
    date: "2026-05-18",
    sort_order: 1,
  }),
  block({
    id: "example-b-11",
    type: "stay",
    title: "Two Harbors Campground",
    subtitle: "Walk-in sites · last night on island",
    status: "confirmed",
    date: "2026-05-18",
    sort_order: 2,
  }),

  // Day 5 — Tue May 19: ferry home
  block({
    id: "example-b-12",
    type: "transport",
    title: "Two Harbors ferry to mainland",
    subtitle: "Catalina Express, 12:30 PM departure",
    status: "confirmed",
    date: "2026-05-19",
    sort_order: 0,
    transport_mode: "ferry",
    from_location: "Two Harbors",
    to_location: "San Pedro",
    duration_min: 75,
  }),
];

const block_bookings: BlockBooking[] = [];

function pack(partial: Partial<PackingItem> & Pick<PackingItem, "id" | "label" | "category" | "scope" | "sort_order">): PackingItem {
  return {
    trip_id: TRIP_ID,
    assigned_to: null,
    packed: false,
    created_by: AVERY,
    created_at: FIXED_TS,
    deleted_at: null,
    ...partial,
  };
}

const packing_items: PackingItem[] = [
  pack({ id: "example-pk-1", label: "4-person tent (Avery)", category: "Camping", scope: "shared", assigned_to: AVERY, packed: true, sort_order: 0 }),
  pack({ id: "example-pk-2", label: "Water filter (Jordan)", category: "Camping", scope: "shared", assigned_to: JORDAN, sort_order: 1 }),
  pack({ id: "example-pk-3", label: "Stove + fuel canister (Sam)", category: "Camping", scope: "shared", assigned_to: SAM, packed: true, sort_order: 2 }),
  pack({ id: "example-pk-4", label: "Sleeping bag (0–30°F)", category: "Personal gear", scope: "personal", packed: true, sort_order: 3 }),
  pack({ id: "example-pk-5", label: "Headlamp + spare batteries", category: "Personal gear", scope: "personal", packed: true, sort_order: 4 }),
  pack({ id: "example-pk-6", label: "Trekking poles", category: "Personal gear", scope: "personal", sort_order: 5 }),
  pack({ id: "example-pk-7", label: "Sunscreen + lip balm", category: "Toiletries", scope: "personal", sort_order: 6 }),
  pack({ id: "example-pk-8", label: "3L water bladder", category: "Hydration", scope: "personal", packed: true, sort_order: 7 }),
];

const resources: Resource[] = [
  {
    id: "example-r-1",
    trip_id: TRIP_ID,
    category: "booking",
    title: "Catalina Island Conservancy — TCT permits",
    url: "https://www.catalinaconservancy.org/index.php?s=trans-catalina-trail",
    description: "Reserve campgrounds and pick up your free Trans-Catalina hiking permit here.",
    added_by: AVERY,
    created_at: FIXED_TS,
  },
  {
    id: "example-r-2",
    trip_id: TRIP_ID,
    category: "trail_map",
    title: "Official Trans-Catalina Trail map",
    url: "https://www.catalinaconservancy.org/index.php?s=tct-map",
    description: "PDF with mileage, elevation, and water sources for each segment.",
    added_by: AVERY,
    created_at: FIXED_TS,
  },
  {
    id: "example-r-3",
    trip_id: TRIP_ID,
    category: "other",
    title: "NOAA Avalon forecast",
    url: "https://forecast.weather.gov/MapClick.php?lat=33.34&lon=-118.32",
    description: "Check 2–3 days before departure. Wind matters more than rain.",
    added_by: JORDAN,
    created_at: FIXED_TS,
  },
];

export const EXAMPLE_TRIP_BUNDLE: ExampleBundle = {
  trip,
  participants,
  itinerary_blocks,
  block_bookings,
  packing_items,
  resources,
};
