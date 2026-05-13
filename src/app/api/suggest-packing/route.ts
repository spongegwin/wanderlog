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
    max_tokens: 2000,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 3,
      },
    ] as never,
    system: `You are a trip-packing assistant. Given a trip summary, produce a starter packing checklist AND 1-2 high-quality planning resources.

Return ONLY a single valid JSON object, no markdown:
{
  "items": [
    { "label": "Tent (3p)", "category": "Gear", "scope": "shared" },
    { "label": "Headlamp", "category": "Gear", "scope": "personal" }
  ],
  "resources": [
    { "title": "Catalina Conservancy — TCT permits", "url": "https://...", "description": "Official permit and campsite reservation page.", "category": "booking" }
  ]
}

Items:
- Categories: Gear, Clothing, Food, Documents, Other.
- Scopes:
  - "shared" — one for the whole group (tent, stove, water filter, first aid kit, permits, repair kit, group meals)
  - "personal" — each person brings their own (headlamp, sleeping bag, clothing, personal documents, water bottle, snacks)
- 15-25 items, prioritized by importance.
- Be specific to the trip type (backpacking → water filter, sleeping pad; flight trip → passport, charger).
- Default to scope "personal" unless the item is naturally one-per-group.
- Skip the obvious (don't include "toothbrush" or "phone").
- Wildlife and region-specific gear must match the destination. Only suggest bear storage (bear canister, bear bag, bear spray) for destinations with black or brown bears — most coastal islands, deserts, and developed areas do not. When uncertain about region-specific hazards (wildlife, altitude, weather extremes), omit them rather than guess.

Resources:
- After generating items, use web_search to find 1-2 high-quality planning resources for this trip. Prefer in order: (1) official permit/booking pages (NPS, USFS, state/regional parks, conservancies, marine ferry operators), (2) well-regarded guidebook or magazine pages, (3) trusted community write-ups (high-vote Reddit threads, popular trail blogs).
- "category" must be one of: "booking" (reservations, permits, ticket sales), "trail_map" (maps, GPX files), "guide" (blogs, guidebook articles, magazine pieces), "community" (Reddit, forums), "other".
- Only include URLs your web_search actually returned. NEVER invent URLs. If you can't find 1-2 solid resources, return "resources": [].
- "description" should be one sentence about what's on the page and why it's useful.`,
    messages: [{ role: "user", content: summary }],
  });

  // Find the text block in the response (web_search tool use produces multiple
  // content blocks; the model's final JSON is in a text block).
  const textBlock = response.content.find((b) => b.type === "text") as
    | { type: "text"; text: string }
    | undefined;
  const raw = textBlock?.text ?? "";
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    // Support both new {items, resources} shape and the legacy bare-array shape
    if (Array.isArray(parsed)) {
      return NextResponse.json({ items: parsed, resources: [] });
    }
    return NextResponse.json({
      items: Array.isArray(parsed.items) ? parsed.items : [],
      resources: Array.isArray(parsed.resources) ? parsed.resources : [],
    });
  } catch {
    return NextResponse.json({ error: "Parse failed", raw }, { status: 422 });
  }
}
