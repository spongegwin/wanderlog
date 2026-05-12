import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { from, to, mode } = await req.json();

  if (!from || !to) {
    return NextResponse.json({ error: "from and to required" }, { status: 400 });
  }

  const modeText = mode ?? "drive";

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    system: `You are a travel-distance estimator. Given a "from" location, "to" location, and travel mode, return a realistic estimate.

Return ONLY valid JSON, no markdown, no explanation:
{
  "distance_mi": number,    // statute miles
  "duration_min": number    // realistic travel time in minutes including typical conditions (traffic, ferry schedule, etc.)
}

Rules:
- Use real-world averages, not theoretical minimums
- "drive": include moderate traffic; freeway speeds ~60-70mph
- "ferry": typical operating speed + boarding/disembark overhead
- "flight": gate-to-gate including taxi; not just air time
- "transit": realistic public transit timing
- "walk": ~3 mph average
- Never return zero or negative; if you can't estimate, pick the most plausible single number`,
    messages: [
      {
        role: "user",
        content: `From: ${from}\nTo: ${to}\nMode: ${modeText}`,
      },
    ],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "";
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    return NextResponse.json({
      distance_mi: Number(parsed.distance_mi) || null,
      duration_min: Number(parsed.duration_min) || null,
    });
  } catch {
    return NextResponse.json({ error: "Parse failed", raw }, { status: 422 });
  }
}
