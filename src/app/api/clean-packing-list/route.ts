import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { raw, tripId } = await req.json();
  if (typeof raw !== "string") {
    return NextResponse.json({ error: "raw text required" }, { status: 400 });
  }

  // Optional trip context for better scope inference
  let tripContext = "";
  if (tripId) {
    try {
      const supabase = await createClient();
      const [{ data: trip }, { data: blocks }] = await Promise.all([
        supabase.from("trips").select("name, destination, essence").eq("id", tripId).single(),
        supabase.from("itinerary_blocks").select("type, title").eq("trip_id", tripId).limit(20),
      ]);
      if (trip) {
        tripContext = `Trip: ${trip.name}
Destination: ${trip.destination ?? "—"}
Essence: ${trip.essence ?? "—"}
Activities: ${(blocks ?? []).map((b) => `${b.type}: ${b.title}`).join("; ")}`;
      }
    } catch {
      // Non-fatal — proceed without trip context
    }
  }

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2500,
    system: `You are a packing-list organizer. Reorganize a (possibly messy) packing list into a clean, structured plain-text format.

Output ONLY the structured text — NO markdown fences, NO commentary, NO leading or trailing prose. Just the list.

Format (exact):
SHARED · Gear
- Item label
- Item label — Assignee Name

SHARED · Clothing
- Item

PERSONAL · Gear
- Item

PERSONAL · Other
- Item

Strict rules:
- Two top-level scopes only: SHARED, PERSONAL
  - SHARED = one-per-group (tent, stove, water filter, permits, bear bag, first aid kit, repair kit, group meals)
  - PERSONAL = one-per-person (headlamp, sleeping bag, clothing, water bottle, snacks, personal documents)
  - Default to PERSONAL unless the item is naturally one-per-group
- Five categories per scope: Gear, Clothing, Food, Documents, Other
- Header pattern: \`SHARED · Category\` or \`PERSONAL · Category\` on its own line
- Items start with \`- \`
- For SHARED items, preserve trailing assignee with format \` — Name\` (em-dash + space). Do NOT add assignees that aren't in the input.
- Deduplicate items (case-insensitive label match within same scope+category). Keep the first occurrence.
- DO NOT invent new items. Only reorganize what's provided.
- Skip junk lines (empty headers, bullet-only lines, "etc.", "...", section dividers).
- Trim and normalize labels — preserve specifics like "(3p)" or "0°F" but strip excessive punctuation.
- Order: SHARED first, then PERSONAL. Within each scope, order categories: Gear, Clothing, Food, Documents, Other.`,
    messages: [
      {
        role: "user",
        content: tripContext
          ? `${tripContext}\n\nList to clean up:\n\n${raw}`
          : `List to clean up:\n\n${raw}`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const cleaned = text.replace(/^```(?:text|plaintext)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

  return NextResponse.json({ cleaned });
}
