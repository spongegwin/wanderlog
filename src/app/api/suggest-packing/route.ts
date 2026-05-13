import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { tripId } = await req.json();
  if (!tripId) return NextResponse.json({ error: "tripId required" }, { status: 400 });

  const supabase = await createClient();

  const [{ data: trip }, { data: blocks }] = await Promise.all([
    supabase.from("trips").select("*").eq("id", tripId).single(),
    supabase
      .from("itinerary_blocks")
      .select("type, title, hike_distance, hike_elev_gain, transport_mode")
      .eq("trip_id", tripId),
  ]);

  if (!trip) return NextResponse.json({ error: "trip not found" }, { status: 404 });

  const summary = `Trip: ${trip.name}
Destination: ${trip.destination ?? "—"}
Dates: ${trip.start_date ?? "?"} to ${trip.end_date ?? "?"}
Essence: ${trip.essence ?? "—"}
Blocks: ${(blocks ?? []).map((b) => `${b.type}: ${b.title}`).join("; ")}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    system: `You are a trip-packing assistant. Given a trip summary, produce a starter packing checklist.

Return ONLY valid JSON array, no markdown:
[
  { "label": "Tent (3p)", "category": "Gear", "scope": "shared" },
  { "label": "Headlamp", "category": "Gear", "scope": "personal" },
  ...
]

Categories: Gear, Clothing, Food, Documents, Other.
Scopes:
- "shared" — one for the whole group (tent, stove, water filter, first aid kit, permits, repair kit, group meals)
- "personal" — each person brings their own (headlamp, sleeping bag, clothing, personal documents, water bottle, snacks)

Rules:
- 15-25 items, prioritized by importance
- Be specific to the trip type (backpacking → water filter, sleeping pad; flight trip → passport, charger)
- Default to scope "personal" unless the item is naturally one-per-group
- Skip the obvious (don't include "toothbrush" or "phone")
- Wildlife and region-specific gear must match the destination. Only suggest bear storage (bear canister, bear bag, bear spray) for destinations with black or brown bears — most coastal islands, deserts, and developed areas do not. When uncertain about region-specific hazards (wildlife, altitude, weather extremes), omit them rather than guess.`,
    messages: [{ role: "user", content: summary }],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "";
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

  try {
    const items = JSON.parse(cleaned);
    return NextResponse.json({ items: Array.isArray(items) ? items : [] });
  } catch {
    return NextResponse.json({ error: "Parse failed", raw }, { status: 422 });
  }
}
