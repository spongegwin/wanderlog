import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { question, tripId } = await req.json();
  if (!question || !tripId) {
    return NextResponse.json({ error: "question and tripId required" }, { status: 400 });
  }

  const supabase = await createClient();

  const [{ data: trip }, { data: blocks }, { data: participants }, { data: packing }] =
    await Promise.all([
      supabase.from("trips").select("*").eq("id", tripId).single(),
      supabase
        .from("itinerary_blocks")
        .select(
          "id, type, title, subtitle, status, day_label, date, hike_start, hike_end, hike_distance, hike_elev_gain, hike_est_hours, hike_difficulty, hike_waypoints, transport_mode, from_location, to_location, distance_mi, duration_min, cost_amount, cost_currency, booking_conf, booking_details, cancel_deadline"
        )
        .eq("trip_id", tripId)
        .order("date", { ascending: true }),
      supabase
        .from("participants")
        .select("name, role")
        .eq("trip_id", tripId),
      supabase
        .from("packing_items")
        .select("label, category, scope")
        .eq("trip_id", tripId)
        .is("deleted_at", null)
        .limit(50),
    ]);

  if (!trip) return NextResponse.json({ error: "trip not found" }, { status: 404 });

  const tripContext = {
    name: trip.name,
    destination: trip.destination,
    start_date: trip.start_date,
    end_date: trip.end_date,
    essence: trip.essence,
    participants: (participants ?? []).map((p) => ({
      name: (p as { name: string }).name,
      role: (p as { role: string }).role,
    })),
    blocks: (blocks ?? []).map((b) => {
      type B = {
        title: string; type: string; status: string; date: string | null; day_label: string | null;
        subtitle: string | null; hike_start: string | null; hike_end: string | null;
        hike_distance: string | null; hike_elev_gain: string | null; hike_est_hours: string | null;
        from_location: string | null; to_location: string | null;
        distance_mi: number | null; duration_min: number | null; transport_mode: string | null;
        hike_waypoints: unknown; cost_amount: number | null; booking_conf: string | null;
      };
      const block = b as B;
      const has_waypoints = Array.isArray(block.hike_waypoints) && block.hike_waypoints.length > 0;
      return {
        title: block.title,
        type: block.type,
        status: block.status,
        date: block.date,
        day_label: block.day_label,
        subtitle: block.subtitle,
        hike: block.hike_start ? `${block.hike_start} → ${block.hike_end ?? "?"}` : null,
        hike_stats: [block.hike_distance, block.hike_elev_gain, block.hike_est_hours]
          .filter(Boolean)
          .join(" · "),
        transport: block.from_location ? `${block.from_location} → ${block.to_location ?? "?"}` : null,
        transport_meta:
          block.transport_mode ||
          block.distance_mi ||
          block.duration_min
            ? `${block.transport_mode ?? ""} ${block.distance_mi ?? "?"}mi ${block.duration_min ?? "?"}min`.trim()
            : null,
        booking: block.booking_conf,
        cost: block.cost_amount,
        has_waypoints,
      };
    }),
    packing_summary: {
      total: (packing ?? []).length,
      shared: (packing ?? []).filter((p) => (p as { scope?: string }).scope === "shared").length,
      personal: (packing ?? []).filter((p) => (p as { scope?: string }).scope === "personal").length,
    },
  };

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 5000,
    system: `You are a trip-planning assistant for Wanderlog. The user is in the middle of planning. They will ask a planning question. You have access to the trip's full state (participants, dates, all blocks, packing list summary).

Your job:
1. Give a clear, concrete answer (2-5 sentences). Use your knowledge of travel logistics (typical ferry schedules, drive times, traffic, etc.) — be specific with times and numbers when sensible. NEVER hallucinate booking references, prices, or confirmation numbers.
2. Propose concrete actions the user can add to the trip. Each action is either:
   - a **block** to add (new itinerary item), or
   - **waypoints** to add to an existing hike block.

CRITICAL OUTPUT RULE: Respond with a SINGLE valid JSON object and NOTHING ELSE. No prose before the opening "{". No commentary after the closing "}". No markdown fences. No "Here's the JSON:" preamble. Start your response with "{" — period.

JSON schema:
{
  "answer": "Plain-English answer to the question.",
  "suggestions": [
    {
      "kind": "block",
      "reason": "Why this block is useful (1 sentence).",
      "block": {
        "type": "flight" | "stay" | "activity" | "meal" | "transport" | "hike" | "rest" | "idea",
        "icon": "single emoji",
        "title": "Specific title",
        "subtitle": "1-line context",
        "status": "idea" | "suggested" | "confirmed",
        "day_label": "string or null",
        "date": "YYYY-MM-DD or null",
        "transport_mode": "drive" | "ferry" | "flight" | "transit" | "walk" | "other" | null,
        "from_location": "string or null",
        "to_location": "string or null",
        "distance_mi": number | null,
        "duration_min": number | null,
        "booking_conf": null,
        "cost_amount": number | null,
        "cost_currency": "USD" | null,
        "cancel_deadline": null
      }
    },
    {
      "kind": "waypoints",
      "reason": "Why these waypoints fit the hike.",
      "target_block_title": "Title of the existing hike block this should attach to",
      "waypoints": [
        {
          "location": "Waypoint name",
          "elevation_ft": number | null,
          "gain_ft": number | null,
          "loss_ft": number | null,
          "dist_mi": number | null,
          "total_dist_mi": number | null,
          "duration": "H:MM" | null,
          "time": "HH:MM" | null,
          "escape": "string or null",
          "notes": "string or null",
          "is_break": boolean
        }
      ]
    }
  ]
}

Rules:
- "suggestions" can be empty if the question is purely informational
- Prefer status "suggested" for new blocks (so they enter the voting flow) unless the user clearly indicates "confirmed" intent
- For dates: use trip start_date / end_date / existing block dates as anchors; only return null if truly unknowable
- For waypoints kind: target_block_title must approximately match an existing hike block's title; otherwise propose a new block kind instead
- Keep suggestions tight: 1-4 items max, ranked most useful first
- Times should be realistic; include travel buffers for known choke points (airport arrival ≥90min for domestic flights, etc.)`,
    messages: [
      {
        role: "user",
        content: `Trip context:\n${JSON.stringify(tripContext, null, 2)}\n\nQuestion: ${question}`,
      },
    ],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "";

  // Robust JSON extraction:
  // 1. Strip ```json``` / ``` fences anywhere in the text
  // 2. Find the first { and last } and slice
  // 3. Fall back to bare cleaned text if no braces
  function extractJson(text: string): string {
    let s = text.replace(/```(?:json)?/gi, "").trim();
    const first = s.indexOf("{");
    const last = s.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) {
      s = s.slice(first, last + 1);
    }
    return s.trim();
  }

  const cleaned = extractJson(raw);

  try {
    const parsed = JSON.parse(cleaned);
    return NextResponse.json(parsed);
  } catch (e) {
    console.error("plan-assist JSON parse failed", {
      error: e instanceof Error ? e.message : String(e),
      stop_reason: response.stop_reason,
      raw_first_200: raw.slice(0, 200),
      raw_last_200: raw.slice(-200),
    });
    return NextResponse.json(
      {
        error: "AI returned malformed JSON — try rephrasing your question.",
        debug: {
          stop_reason: response.stop_reason,
          raw_preview: raw.slice(0, 500),
        },
      },
      { status: 422 }
    );
  }
}
