import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { text, tripId } = await req.json();

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
        const existing =
          (blocks ?? [])
            .filter((b) => (b as { date: string | null }).date)
            .map(
              (b) =>
                `${(b as { date: string }).date} (${(b as { day_label: string | null }).day_label ?? ""}): ${(b as { title: string }).title}`
            )
            .slice(0, 20)
            .join("\n") || "(none yet)";

        tripContext = `Trip context (use to infer the date):
- Name: ${trip.name}
- Destination: ${trip.destination ?? "—"}
- Dates: ${trip.start_date ?? "?"} to ${trip.end_date ?? "?"}
- Existing blocks (date, label, title):
${existing}`;
      }
    } catch {
      // proceed without context
    }
  }

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 2,
      },
    ] as never,
    system: `You are a hiking stage data extractor. Parse freeform text and extract structured hiking fields.

Return ONLY valid JSON, no markdown.

Schema:
{
  "name": string,
  "start_point": string,
  "end_point": string,
  "distance": string | null,
  "elevation_gain": string | null,
  "est_hours": string | null,
  "day_label": string | null,
  "date": string | null (ISO YYYY-MM-DD),
  "difficulty": "easy" | "moderate" | "strenuous" | null,
  "has_variant": boolean,
  "variant_note": string | null,
  "notes": string | null,
  "booking_link": string | null,
  "confidence": {
    "name": "found" | "inferred" | "missing",
    "start_point": "found" | "inferred" | "missing",
    "end_point": "found" | "inferred" | "missing",
    "distance": "found" | "inferred" | "missing",
    "elevation_gain": "found" | "inferred" | "missing",
    "est_hours": "found" | "inferred" | "missing",
    "day_label": "found" | "inferred" | "missing",
    "date": "found" | "inferred" | "missing",
    "difficulty": "found" | "inferred" | "missing"
  }
}

Rules:
- "found": field is explicitly stated in the text
- "inferred": derived logically (e.g. difficulty from elevation gain, hours from distance, date from trip sequence)
- "missing": not present and cannot be safely inferred
- NEVER hallucinate distances or elevations — mark missing
- Infer difficulty: <2000ft=easy, 2000-4000ft=moderate, >4000ft=strenuous
- Infer hours: roughly 2mi/hr + 1hr per 1000ft gain as a baseline

Booking link (booking_link):
- When the hike is a named, recognizable trail/route (e.g., "Trans-Catalina Trail", "Half Dome", "Mount Whitney"), use web_search to find the official trail or permit page and put the URL in booking_link.
- Prefer official sources: NPS, USFS, BLM, state/regional parks, conservancies, trail councils. Avoid blogs or AllTrails as the primary link.
- For unnamed or generic hikes ("morning walk", "ridge hike"), leave booking_link as null.
- NEVER invent URLs. Only include a URL that web_search actually returned.

Date inference (IMPORTANT):
- Always propose a date when there's any signal — explicit, contextual, or sequential.
- Explicit cues: a date ("May 19"), weekday + month ("Tue May 19"), or "day N of trip".
- Contextual cues: "first day", "last day", "second hiking day".
- Sequential default: if no date cue and there are existing blocks in the trip, propose the day after the latest existing date (most likely a new hiking day).
- Set confidence.date to "found" if explicit, "inferred" if guessed from context, "missing" only if truly nothing to go on.
- Day_label should match the chosen date (e.g. "Tue May 19").`,
    messages: [
      {
        role: "user",
        content: tripContext ? `${tripContext}\n\nText to parse:\n${text}` : text,
      },
    ],
  });

  // web_search produces multiple content blocks; find the text block with the JSON
  const textBlock = response.content.find((b) => b.type === "text") as
    | { type: "text"; text: string }
    | undefined;
  const raw = textBlock?.text ?? "";
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  try {
    return NextResponse.json(JSON.parse(cleaned));
  } catch {
    return NextResponse.json({ error: "Parse failed", raw }, { status: 422 });
  }
}
