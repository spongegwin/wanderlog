import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toICSDate(iso: string, hour = 9, minute = 0): string {
  // YYYYMMDDTHHmmss (floating local time — no Z)
  const d = new Date(iso + "T00:00:00");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(hour)}${pad(minute)}00`;
}

function toICSDateOnly(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: trip }, { data: blocks }] = await Promise.all([
    supabase.from("trips").select("*").eq("id", id).single(),
    supabase.from("itinerary_blocks").select("*").eq("trip_id", id),
  ]);

  if (!trip) {
    return new NextResponse("Trip not found", { status: 404 });
  }

  const stamp = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Wanderlog//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  // Trip-level all-day event
  if (trip.start_date && trip.end_date) {
    // For DTEND on all-day, ICS expects the day after the last day
    const end = new Date(trip.end_date + "T00:00:00");
    end.setDate(end.getDate() + 1);
    const endIso = end.toISOString().slice(0, 10);
    lines.push(
      "BEGIN:VEVENT",
      `UID:trip-${trip.id}@wanderlog`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${toICSDateOnly(trip.start_date)}`,
      `DTEND;VALUE=DATE:${toICSDateOnly(endIso)}`,
      `SUMMARY:${escapeText(trip.name)}`,
      trip.destination ? `LOCATION:${escapeText(trip.destination)}` : "",
      trip.essence ? `DESCRIPTION:${escapeText(trip.essence)}` : "",
      "END:VEVENT"
    );
  }

  // Each block with a date becomes an event
  for (const b of blocks ?? []) {
    if (!b.date) continue;
    const start = toICSDate(b.date, 9, 0);
    // Duration: 1h default; transport blocks use duration_min if set
    const durMin = b.duration_min ?? 60;
    const endHour = 9 + Math.floor(durMin / 60);
    const endMin = durMin % 60;
    const end = toICSDate(b.date, Math.min(endHour, 23), endMin);

    const descParts: string[] = [];
    if (b.subtitle) descParts.push(b.subtitle);
    if (b.from_location || b.to_location) {
      descParts.push(`${b.from_location ?? "?"} → ${b.to_location ?? "?"}`);
    }
    if (b.hike_distance) descParts.push(`Distance: ${b.hike_distance}`);
    if (b.hike_elev_gain) descParts.push(`Elev gain: ${b.hike_elev_gain}`);
    if (b.booking_conf) descParts.push(`Conf: ${b.booking_conf}`);
    if (b.booking_details) descParts.push(b.booking_details);

    lines.push(
      "BEGIN:VEVENT",
      `UID:block-${b.id}@wanderlog`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${escapeText(b.title)}`,
      b.to_location ? `LOCATION:${escapeText(b.to_location)}` : "",
      descParts.length ? `DESCRIPTION:${escapeText(descParts.join("\n"))}` : "",
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");

  const body = lines.filter(Boolean).join("\r\n");
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${trip.name.replace(/[^a-z0-9]+/gi, "-")}.ics"`,
    },
  });
}
