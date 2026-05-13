import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { tripId } = await req.json();
  if (!tripId) return NextResponse.json({ error: "tripId required" }, { status: 400 });

  const supabase = await createClient();

  const [{ data: trip }, { data: blocks }, { data: participants }] = await Promise.all([
    supabase.from("trips").select("*").eq("id", tripId).single(),
    supabase
      .from("itinerary_blocks")
      .select("*")
      .eq("trip_id", tripId)
      .order("date", { ascending: true })
      .order("sort_order", { ascending: true }),
    supabase.from("participants").select("name, role").eq("trip_id", tripId),
  ]);

  if (!trip) return NextResponse.json({ error: "trip not found" }, { status: 404 });

  const tripData = {
    name: trip.name,
    destination: trip.destination,
    start_date: trip.start_date,
    end_date: trip.end_date,
    essence: trip.essence,
    participants: (participants ?? []).map((p: { name: string | null }) => p.name).filter(Boolean),
    blocks: (blocks ?? [])
      .filter((b: { status: string }) => b.status !== "idea")
      .map((b: {
        type: string; title: string; subtitle: string | null; status: string;
        date: string | null; day_label: string | null; from_location: string | null;
        to_location: string | null; transport_mode: string | null;
        hike_start: string | null; hike_end: string | null; hike_distance: string | null;
        hike_elev_gain: string | null; hike_est_hours: string | null; hike_difficulty: string | null;
        hike_waypoints: unknown; booking_conf: string | null; booking_details: string | null;
        booking_link: string | null; cancel_deadline: string | null;
        distance_mi: number | null; duration_min: number | null;
      }) => ({
        type: b.type,
        title: b.title,
        subtitle: b.subtitle,
        status: b.status,
        date: b.date,
        day_label: b.day_label,
        from_location: b.from_location,
        to_location: b.to_location,
        transport_mode: b.transport_mode,
        hike_start: b.hike_start,
        hike_end: b.hike_end,
        hike_distance: b.hike_distance,
        hike_elev_gain: b.hike_elev_gain,
        hike_est_hours: b.hike_est_hours,
        hike_difficulty: b.hike_difficulty,
        hike_waypoints: Array.isArray(b.hike_waypoints) ? b.hike_waypoints : [],
        booking_conf: b.booking_conf,
        booking_details: b.booking_details,
        booking_link: b.booking_link,
        cancel_deadline: b.cancel_deadline,
        distance_mi: b.distance_mi,
        duration_min: b.duration_min,
      })),
  };

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    system: `You generate clean, offline-readable trip sheets in Markdown. The traveler will save this as a file to open without internet — on the trail, at the airport, anywhere without signal.

Format rules:
- First line: # {Trip Name} — {Destination}
- Second line: **{Date range}** · **{N} travelers:** {comma-separated names}
- If there's an essence/tagline, add it as a third line in italics
- Blank line, then ---
- Group confirmed/suggested blocks by date: ## Day N — {Weekday, Mon DD}
- Blocks without dates go in a ## Unscheduled section at the end (if any)
- Each block is a ### with an emoji + type + title:
  - flight/transport: show route (from → to), mode, distance/duration if known, confirmation number
  - stay: show address/location (to_location), check-in details (subtitle), confirmation number
  - meal: show name, address (to_location)
  - hike: show start → end, then stats line (distance · ↑ elevation · est time · difficulty), then if waypoints exist render a pipe table with columns: Waypoint | Total mi | Time | Escape — omit Escape column if no waypoints have escape routes
  - activity: show location and any booking info
- For cancel deadlines: show as "Cancel by {date}" on its own line
- End with ## Key Info section with two sub-lists:
  - **Addresses** — one line per venue that has a location
  - **Confirmations** — one line per block with a confirmation number
- Skip idea blocks entirely
- Be terse. No filler sentences. Just facts.
- Output only the markdown. No code fences. No preamble.`,
    messages: [
      {
        role: "user",
        content: `Generate a trip sheet:\n\n${JSON.stringify(tripData, null, 2)}`,
      },
    ],
  });

  const textBlock = response.content.find((c) => c.type === "text") as
    | { type: "text"; text: string }
    | undefined;

  return NextResponse.json({ markdown: textBlock?.text ?? "" });
}
