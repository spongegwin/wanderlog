import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { text, tripId } = await req.json();

  // Build trip context for smarter date inference
  let tripContext = "";
  if (tripId) {
    try {
      const supabase = await createClient();
      const [{ data: trip }, { data: blocks }] = await Promise.all([
        supabase
          .from("trips")
          .select("name, destination, start_date, end_date")
          .eq("id", tripId)
          .single(),
        supabase
          .from("itinerary_blocks")
          .select("date, day_label, title")
          .eq("trip_id", tripId)
          .order("date", { ascending: true })
          .limit(50),
      ]);

      if (trip) {
        const datesSummary =
          (blocks ?? [])
            .filter((b) => (b as { date: string | null }).date)
            .map(
              (b) =>
                `${(b as { date: string }).date} (${(b as { day_label: string | null }).day_label ?? ""}): ${
                  (b as { title: string }).title
                }`
            )
            .slice(0, 20)
            .join("\n") || "(none yet)";

        tripContext = `Trip context (use to infer the date):
- Name: ${trip.name}
- Destination: ${trip.destination ?? "—"}
- Dates: ${trip.start_date ?? "?"} to ${trip.end_date ?? "?"}
- Existing blocks (date, label, title):
${datesSummary}`;
      }
    } catch {
      // ignore — proceed without context
    }
  }

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1200,
    system: `You are a travel itinerary parser. Given freeform text, extract a structured itinerary block.

Return ONLY valid JSON, no markdown, no explanation.

Schema:
{
  "type": "flight" | "stay" | "activity" | "meal" | "transport" | "hike" | "rest" | "idea",
  "icon": string (single emoji),
  "title": string,
  "subtitle": string,
  "status": "idea" | "suggested" | "confirmed",
  "day_label": string | null,
  "date": string | null (ISO YYYY-MM-DD),
  "booking_conf": string | null,
  "cost_amount": number | null,
  "cost_currency": string | null,
  "cancel_deadline": string | null (ISO date),
  "transport_mode": "drive" | "ferry" | "flight" | "transit" | "walk" | "other" | null,
  "from_location": string | null,
  "to_location": string | null,
  "distance_mi": number | null,
  "duration_min": number | null
}

Rules:
- type "hike" only for multi-hour trail stages with distance/elevation
- type "rest" for explicit rest/recovery days
- type "transport" for drives, ferries, trains, buses; "flight" stays as its own type
- icon should match the type naturally
- status "confirmed" only if a booking reference or explicit confirmation is mentioned
- Never hallucinate booking references
- For transport/flight: extract from_location, to_location, and transport_mode if stated; estimate distance only if obvious

Date inference (IMPORTANT):
- Always propose a date when there's any signal — explicit, contextual, or sequential.
- Explicit cues: a date ("May 19"), weekday + month ("Tue May 19"), or "day N of trip".
- Contextual cues: "the night before", "first day", "last night", "afternoon of day 2".
- Sequential default: if input lacks any date cue but a trip is in progress with existing blocks, propose the date of the latest existing block (continue the same day), or the day after the latest if input implies new-day activity (overnight stay, next morning, etc.).
- Day_label should match: e.g. "Tue May 19" or "Day 2 · night" — be consistent with existing labels in the trip.
- Only return date: null if there is genuinely no plausible inference (e.g. trip has no dates set AND input mentions no date).
- Pre-trip arrivals are fine: date can be before start_date if input implies it.`,
    messages: [
      {
        role: "user",
        content: tripContext ? `${tripContext}\n\nText to parse:\n${text}` : text,
      },
    ],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "";
  // Strip markdown code fences if present
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    // Always return an array so the UI can show and add multiple blocks at once
    return NextResponse.json(Array.isArray(parsed) ? parsed : [parsed]);
  } catch {
    return NextResponse.json({ error: "Parse failed", raw }, { status: 422 });
  }
}
