import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { text, url } = await req.json();

  let content = text as string | undefined;
  let sourceTitle: string | undefined;

  if (url) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Wanderlog/1.0 (trip planner)" },
      });
      const html = await res.text();

      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) sourceTitle = titleMatch[1].trim();

      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      const bodyHtml = bodyMatch ? bodyMatch[1] : html;
      content = bodyHtml
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s{2,}/g, " ")
        .slice(0, 12000);
    } catch {
      return NextResponse.json({ error: "Could not fetch URL" }, { status: 422 });
    }
  }

  if (!content) {
    return NextResponse.json({ error: "No content provided" }, { status: 400 });
  }

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: `You are a hiking timetable extractor. Given freeform text from a trail guide, blog, spreadsheet, or email, extract a waypoint timetable.

Return ONLY valid JSON array, no markdown, no explanation.

Schema for each waypoint:
{
  "location": string,           // waypoint name
  "elevation_ft": number | null,
  "gain_ft": number | null,     // elevation gain for this segment
  "loss_ft": number | null,     // elevation loss for this segment
  "dist_mi": number | null,     // distance for this segment in miles
  "total_dist_mi": number | null, // cumulative distance
  "duration": string | null,    // "H:MM" format
  "time": string | null,        // "HH:MM" ETA
  "escape": string | null,      // escape route description if any
  "notes": string | null,
  "is_break": boolean           // true for rest stops, lunch, morning break, etc.
}

Rules:
- Return [] if no timetable can be extracted
- is_break: true for any rest stop, lunch break, water break, snack stop
- Never hallucinate elevations, distances, or times — leave null if not stated
- duration must be "H:MM" format (e.g. "1:30", "0:45")
- time must be "HH:MM" 24hr format (e.g. "07:00", "13:30")
- Convert miles to miles (no unit conversion needed if already in miles)`,
    messages: [{ role: "user", content }],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "";
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

  try {
    const waypoints = JSON.parse(cleaned);
    return NextResponse.json({
      waypoints: Array.isArray(waypoints) ? waypoints : [],
      source_title: sourceTitle,
    });
  } catch {
    return NextResponse.json({ error: "Parse failed", raw }, { status: 422 });
  }
}
