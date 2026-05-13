"use client";

import { useMemo } from "react";
import { X, Printer } from "lucide-react";
import type { Trip, ItineraryBlock, Participant, HikeWaypoint } from "@/lib/types";

interface ExportModalProps {
  trip: Trip;
  blocks: ItineraryBlock[];
  participants: Participant[];
  onClose: () => void;
}

const TYPE_EMOJI: Record<string, string> = {
  flight: "✈️", stay: "🏨", activity: "🎯", meal: "🍽️",
  transport: "🚗", hike: "🥾", rest: "😴", idea: "💡",
};

function blockHtml(b: ItineraryBlock): string {
  const emoji = b.icon ?? TYPE_EMOJI[b.type] ?? "📌";
  let html = `<div class="block"><h3>${emoji} ${b.title}</h3>`;

  if (b.type === "hike") {
    const route = [b.hike_start, b.hike_end].filter(Boolean).join(" → ");
    const stats = [
      b.hike_distance,
      b.hike_elev_gain && `↑ ${b.hike_elev_gain}`,
      b.hike_est_hours,
      b.hike_difficulty,
    ].filter(Boolean).join(" · ");
    if (route) html += `<p class="detail">${route}</p>`;
    if (stats) html += `<p class="stats">${stats}</p>`;

    const waypoints = Array.isArray(b.hike_waypoints)
      ? (b.hike_waypoints as HikeWaypoint[])
      : [];
    if (waypoints.length > 0) {
      const hasEscape = waypoints.some((w) => w.escape);
      const cols = hasEscape ? 5 : 4;
      html += `<table><thead><tr>
        <th>Waypoint</th>
        <th>Total mi</th>
        <th>Duration</th>
        <th>Est. time</th>
        ${hasEscape ? "<th>Escape</th>" : ""}
      </tr></thead><tbody>`;
      for (const wp of waypoints) {
        if (wp.is_break) {
          html += `<tr class="break-row"><td colspan="${cols}">☕ ${wp.location}${wp.duration ? ` · ${wp.duration}` : ""}</td></tr>`;
        } else {
          const dist = wp.total_dist_mi != null ? wp.total_dist_mi.toFixed(1) : "—";
          html += `<tr>
            <td>${wp.location}</td>
            <td>${dist}</td>
            <td>${wp.duration ?? "—"}</td>
            <td>${wp.time ?? "—"}</td>
            ${hasEscape ? `<td class="escape">${wp.escape ?? ""}</td>` : ""}
          </tr>`;
        }
      }
      html += `</tbody></table>`;
    }
  } else {
    const isRoute = b.type === "flight" || b.type === "transport";
    if (isRoute && (b.from_location || b.to_location)) {
      html += `<p class="detail">${[b.from_location, b.to_location].filter(Boolean).join(" → ")}</p>`;
    }
    if (!isRoute && b.to_location) {
      const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(b.to_location)}`;
      html += `<p class="detail"><a href="${mapsUrl}">${b.to_location}</a></p>`;
    }
    if (b.subtitle) html += `<p class="detail">${b.subtitle}</p>`;
    if (b.booking_conf) html += `<p class="conf">Conf: ${b.booking_conf}</p>`;
    if (b.cancel_deadline) {
      const d = new Date(b.cancel_deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      html += `<p class="cancel">Cancel by ${d}</p>`;
    }
    if (b.booking_link) {
      html += `<p class="detail"><a href="${b.booking_link}">${b.booking_link}</a></p>`;
    }
  }

  html += `</div>`;
  return html;
}

function generateHtml(trip: Trip, blocks: ItineraryBlock[], participants: Participant[]): string {
  const sorted = [...blocks]
    .filter((b) => b.status !== "idea")
    .sort((a, b) => {
      if (a.date && b.date) return a.date.localeCompare(b.date) || a.sort_order - b.sort_order;
      if (a.date) return -1;
      if (b.date) return 1;
      return a.sort_order - b.sort_order;
    });

  // Group by date or day_label
  const dayMap = new Map<string, { label: string; blocks: ItineraryBlock[] }>();
  const startDate = trip.start_date ? new Date(trip.start_date + "T00:00:00") : null;

  for (const block of sorted) {
    const key = block.date ?? block.day_label ?? "__unscheduled";
    if (!dayMap.has(key)) {
      let label = block.day_label ?? "Unscheduled";
      if (block.date && startDate) {
        const d = new Date(block.date + "T00:00:00");
        const dayNum = Math.round((d.getTime() - startDate.getTime()) / 86400000) + 1;
        label = `Day ${dayNum} — ${d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`;
      } else if (block.date) {
        const d = new Date(block.date + "T00:00:00");
        label = d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
      }
      dayMap.set(key, { label, blocks: [] });
    }
    dayMap.get(key)!.blocks.push(block);
  }

  const dateRange = [trip.start_date, trip.end_date]
    .filter(Boolean)
    .map((d) => new Date(d! + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }))
    .join(" – ");
  const names = participants.map((p) => p.name).filter(Boolean).join(", ");
  const metaParts = [dateRange, names && `${participants.length} ${participants.length === 1 ? "traveler" : "travelers"}: ${names}`].filter(Boolean);

  const addresses = sorted.filter((b) => b.to_location && b.type !== "flight" && b.type !== "transport");
  const confs = sorted.filter((b) => b.booking_conf);

  const daysHtml = [...dayMap.entries()]
    .map(([, { label, blocks }]) => `<section><h2>${label}</h2>${blocks.map(blockHtml).join("")}</section>`)
    .join("");

  const keyInfoHtml = addresses.length > 0 || confs.length > 0 ? `
    <section class="key-info">
      <h2>Key Info</h2>
      ${addresses.length > 0 ? `<h3>Addresses</h3><ul>${addresses.map((b) => `<li><strong>${b.title}:</strong> <a href="https://maps.google.com/?q=${encodeURIComponent(b.to_location!)}">${b.to_location}</a></li>`).join("")}</ul>` : ""}
      ${confs.length > 0 ? `<h3>Confirmations</h3><ul>${confs.map((b) => `<li><strong>${b.title}:</strong> ${b.booking_conf}</li>`).join("")}</ul>` : ""}
    </section>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${trip.name}${trip.destination ? ` — ${trip.destination}` : ""}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.65;color:#1a1a1a;max-width:740px;margin:0 auto;padding:2.5rem 1.5rem}
  h1{font-size:2rem;font-weight:bold;line-height:1.2}
  .destination{font-size:1.05rem;color:#555;margin-top:.2rem}
  .meta{font-size:.85rem;color:#888;margin-top:.35rem}
  .essence{font-style:italic;color:#555;margin-top:.75rem;font-size:.95rem}
  hr{border:none;border-top:1px solid #ddd;margin:2rem 0}
  section{margin-bottom:2rem}
  h2{font-size:1.1rem;font-weight:bold;border-bottom:2px solid #1a1a1a;padding-bottom:.3rem;margin-bottom:1rem}
  .block{margin-bottom:1.25rem;padding-left:.75rem;border-left:3px solid #eee}
  h3{font-size:.95rem;font-weight:bold;margin-bottom:.25rem}
  .detail{font-size:.85rem;color:#555;margin-top:.15rem}
  .stats{font-family:ui-monospace,monospace;font-size:.8rem;color:#666;margin-top:.15rem}
  .conf{font-family:ui-monospace,monospace;font-size:.8rem;color:#444;margin-top:.15rem}
  .cancel{font-size:.8rem;color:#b45309;margin-top:.15rem}
  a{color:#2563eb}
  table{width:100%;border-collapse:collapse;font-size:.85rem;margin:.6rem 0 .25rem;font-family:ui-monospace,monospace}
  th{text-align:left;padding:.3rem .5rem;border-bottom:2px solid #ccc;font-size:.72rem;color:#666;font-family:Georgia,serif;font-weight:bold;letter-spacing:.02em}
  td{padding:.45rem .5rem;border-bottom:1px solid #ebebeb;vertical-align:top}
  tr:last-child td{border-bottom:none}
  .break-row td{font-style:italic;color:#999;background:#fafafa}
  .escape{color:#b45309;font-size:.8rem}
  .key-info h3{font-size:.85rem;font-weight:bold;margin:1rem 0 .4rem;color:#555;text-transform:uppercase;letter-spacing:.05em}
  ul{padding-left:1.1rem;margin-top:.35rem}
  li{font-size:.85rem;margin-bottom:.2rem;color:#444}
  @media print{
    body{padding:.5rem;font-size:13px}
    .block{page-break-inside:avoid}
    table{page-break-inside:avoid}
  }
</style>
</head>
<body>
  <h1>${trip.name}</h1>
  ${trip.destination ? `<p class="destination">${trip.destination}</p>` : ""}
  ${metaParts.length ? `<p class="meta">${metaParts.join(" · ")}</p>` : ""}
  ${trip.essence ? `<p class="essence">"${trip.essence}"</p>` : ""}
  <hr>
  ${daysHtml}
  ${keyInfoHtml}
</body>
</html>`;
}

export default function ExportModal({ trip, blocks, participants, onClose }: ExportModalProps) {
  const html = useMemo(() => generateHtml(trip, blocks, participants), [trip, blocks, participants]);

  function openAndPrint() {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[88vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--paper-3)]">
          <div>
            <h2 className="font-semibold text-[var(--ink)]">Trip Sheet</h2>
            <p className="text-xs text-[var(--ink-3)] mt-0.5">
              Open in browser · print or save as PDF with <kbd className="font-mono bg-[var(--paper-2)] px-1 py-0.5 rounded text-[10px]">⌘P</kbd>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--ink-3)] hover:text-[var(--ink)] transition p-1 rounded-lg hover:bg-[var(--paper-2)]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Preview */}
        <iframe
          srcDoc={html}
          className="flex-1 w-full border-0 rounded-b-none"
          title="Trip sheet preview"
        />

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--paper-3)]">
          <button
            onClick={openAndPrint}
            className="flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-lg bg-[var(--ink)] text-white hover:opacity-90 transition"
          >
            <Printer size={14} />
            Open &amp; Print
          </button>
        </div>
      </div>
    </div>
  );
}
