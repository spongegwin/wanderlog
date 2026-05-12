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
        .slice(0, 16000);
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
    system: `You are a packing-list extractor. Given freeform text (a gear guide, blog post, email, or pasted list), extract the packing items as a categorized list.

Return ONLY valid JSON array, no markdown:
[
  { "label": "Tent (3-person)", "category": "Gear", "scope": "shared" },
  { "label": "Headlamp", "category": "Gear", "scope": "personal" },
  ...
]

Categories: Gear, Clothing, Food, Documents, Other.
Scopes:
- "shared" — one per group (tent, stove, water filter, permits, bear bag)
- "personal" — each person brings own (headlamp, sleeping bag, clothing, water bottle)

Rules:
- Return [] if no items found
- Be specific: "Headlamp + spare batteries" not "headlamp"
- Default to "personal" unless item is naturally one-per-group
- Skip duplicates and brand-specific marketing fluff
- Skip obvious / non-pack items ("phone", "toothbrush")
- For ambiguous items default category to "Other"
- Aim for 10-30 items; trim if the source is exhaustive`,
    messages: [{ role: "user", content }],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "";
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

  try {
    const items = JSON.parse(cleaned);
    return NextResponse.json({
      items: Array.isArray(items) ? items : [],
      source_title: sourceTitle,
    });
  } catch {
    return NextResponse.json({ error: "Parse failed", raw }, { status: 422 });
  }
}
