import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { raw, tripId, dayDate, dayLabel } = await req.json();

  if (typeof raw !== "string") {
    return NextResponse.json({ error: "raw text required" }, { status: 400 });
  }

  let tripContext = "";
  if (tripId) {
    try {
      const supabase = await createClient();
      const [{ data: trip }, { data: blocks }] = await Promise.all([
        supabase
          .from("trips")
          .select("name, destination, start_date, end_date, essence")
          .eq("id", tripId)
          .single(),
        supabase
          .from("itinerary_blocks")
          .select("date, title, type, status")
          .eq("trip_id", tripId)
          .order("date", { ascending: true })
          .limit(40),
      ]);
      if (trip) {
        const otherDays =
          (blocks ?? [])
            .filter((b) => {
              const blockDate = (b as { date: string | null }).date;
              return blockDate && blockDate !== dayDate;
            })
            .slice(0, 30)
            .map(
              (b) =>
                `  - ${(b as { date: string }).date} · ${(b as { type: string }).type} · ${(b as { title: string }).title}`
            )
            .join("\n") || "  (none)";
        tripContext = `Trip: ${trip.name} · ${trip.destination ?? "—"}
Dates: ${trip.start_date ?? "?"} → ${trip.end_date ?? "?"}
Editing scope: ${dayLabel ?? (dayDate ? dayDate : "Unscheduled")}
Blocks on OTHER days (for context only — do NOT touch these):
${otherDays}`;
      }
    } catch {
      // proceed without context
    }
  }

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2500,
    system: `You are a single-day trip-plan organizer. You receive ONE day's plan as text (possibly messy or unstructured) and return a cleaned, structured version of the SAME day.

CRITICAL OUTPUT RULE: Respond with the canonical text only. NO markdown fences. NO commentary. NO preamble. NO leading or trailing prose.

Output format (exact):
- [status] type · title
- [status] type · title

Each line is one block. Pure text — no emojis, no icons, no leading bullets other than "-".

Allowed statuses: idea, suggested, confirmed, completed
Allowed types: flight, stay, activity, meal, transport, hike, rest, idea

Strict rules:
- Restructure / categorize / set types for the items provided
- DO NOT add new items the user didn't mention
- DO NOT propose moving items to other days (this modal is scoped to one day)
- DO NOT include date headers — the day is already implied by the modal scope
- Preserve titles where possible; trim and normalize but don't paraphrase
- Deduplicate items with the same title (case-insensitive) — keep the first
- Infer type from the title when it isn't given: hike for trail/mountain, stay for camp/hotel/lodge, meal for eat/lunch/dinner/breakfast, transport for drive/ferry/bus/train, flight for airline/airport/boarding, activity for everything tour/visit/swim, rest for explicit rest day, idea for ambiguous
- Infer status if absent — default to "idea" unless the input clearly says "booked", "confirmed", "decided" (→ confirmed) or "maybe", "option", "suggested" (→ suggested)
- Skip junk lines (empty bullets, "etc.", section dividers)`,
    messages: [
      {
        role: "user",
        content: tripContext
          ? `${tripContext}\n\nThis day's items to clean up:\n\n${raw}`
          : `Items to clean up:\n\n${raw}`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  // Strip any code fences just in case the model adds them
  const cleaned = text.replace(/```[a-z]*\s*/gi, "").replace(/```/g, "").trim();

  return NextResponse.json({ cleaned });
}
