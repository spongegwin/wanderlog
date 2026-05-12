import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in your environment.");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Find the TCT trip
const { data: trips } = await supabase
  .from("trips")
  .select("id, name")
  .eq("name", "Trans-Catalina Trail");

if (!trips?.length) {
  console.error("No TCT trip found");
  process.exit(1);
}

const tripId = trips[0].id;
console.log(`Found trip: ${tripId}`);

const { data: blocks } = await supabase
  .from("itinerary_blocks")
  .select("id, day_label, date")
  .eq("trip_id", tripId);

if (!blocks?.length) {
  console.log("No blocks to backfill");
  process.exit(0);
}

// Map day_label patterns → ISO date
const dateMap = {
  "Mon May 18": "2026-05-18",
  "Tue May 19": "2026-05-19",
  "Wed May 20": "2026-05-20",
};

let updated = 0;
for (const b of blocks) {
  if (b.date) continue; // already set
  if (!b.day_label) continue;
  // Strip "night/morning/afternoon/evening" suffix
  const norm = b.day_label.replace(/\s+(night|morning|afternoon|evening)s?\s*$/i, "").trim();
  const iso = dateMap[norm];
  if (!iso) {
    console.log(`  skipping "${b.day_label}" — no mapping`);
    continue;
  }
  const { error } = await supabase
    .from("itinerary_blocks")
    .update({ date: iso })
    .eq("id", b.id);
  if (error) {
    console.error(`  failed to update ${b.id}:`, error);
  } else {
    console.log(`  ${b.day_label} → ${iso}`);
    updated++;
  }
}

console.log(`\n✓ Updated ${updated} blocks`);
