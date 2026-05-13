"use client";

import { useState } from "react";
import type { HikeWaypoint } from "@/lib/types";

const FT_TO_M = 0.3048;
const MI_TO_KM = 1.60934;

interface WaypointTableProps {
  waypoints: HikeWaypoint[];
}

export default function WaypointTable({ waypoints }: WaypointTableProps) {
  const [units, setUnits] = useState<"imperial" | "metric">("imperial");
  if (!waypoints.length) return null;

  const isMetric = units === "metric";

  const fmtElev = (ft: number | null | undefined) => {
    if (ft == null) return "—";
    return isMetric ? Math.round(ft * FT_TO_M).toLocaleString() : ft.toLocaleString();
  };
  const fmtGain = (ft: number | null | undefined) => {
    if (ft == null) return "—";
    return isMetric ? `+${Math.round(ft * FT_TO_M)}` : `+${ft}`;
  };
  const fmtDist = (mi: number | null | undefined) => {
    if (mi == null) return "—";
    return isMetric ? (mi * MI_TO_KM).toFixed(1) : mi.toFixed(1);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex justify-end">
        <button
          onClick={() => setUnits((u) => (u === "imperial" ? "metric" : "imperial"))}
          className="text-[10px] font-medium border border-[var(--paper-3)] rounded-full px-2 py-0.5 text-[var(--ink-3)] hover:bg-[var(--paper-2)] transition"
        >
          {isMetric ? "km / m" : "mi / ft"}
        </button>
      </div>

      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-xs border-collapse min-w-[320px]">
          <thead>
            <tr className="text-[var(--ink-3)] border-b border-[var(--paper-3)]">
              <th className="text-left py-2 pr-3 font-medium">Location</th>
              <th className="text-right py-2 px-2 font-medium whitespace-nowrap hidden sm:table-cell">
                {isMetric ? "Elev m" : "Elev ft"}
              </th>
              <th className="text-right py-2 px-2 font-medium whitespace-nowrap hidden sm:table-cell">↑</th>
              <th className="text-right py-2 px-2 font-medium whitespace-nowrap hidden sm:table-cell">
                {isMetric ? "km" : "mi"}
              </th>
              <th className="text-right py-2 px-2 font-medium whitespace-nowrap">
                {isMetric ? "Total km" : "Total mi"}
              </th>
              <th className="text-right py-2 px-2 font-medium whitespace-nowrap">Time</th>
              <th className="text-left py-2 pl-2 font-medium hidden sm:table-cell">Escape</th>
            </tr>
          </thead>
          <tbody>
            {waypoints.map((wp, i) => {
              if (wp.is_break) {
                return (
                  <tr key={i} className="border-b border-[var(--paper-2)]">
                    <td colSpan={7} className="py-2.5 text-[var(--ink-3)] italic pl-3">
                      ☕ {wp.location}
                      {wp.duration && ` · ${wp.duration}`}
                    </td>
                  </tr>
                );
              }

              const isLast = i === waypoints.length - 1;
              const hasEscape = !!wp.escape;

              return (
                <tr
                  key={i}
                  className={`border-b border-[var(--paper-2)] ${hasEscape ? "border-l-2 border-l-amber-400" : ""}`}
                >
                  <td className={`py-2.5 pr-3 ${isLast ? "font-semibold" : ""}`}>
                    {wp.location}
                    {hasEscape && (
                      <span className="block text-amber-600 text-[10px] sm:hidden">
                        ↪ {wp.escape}
                      </span>
                    )}
                  </td>
                  <td className="text-right py-2.5 px-2 text-[var(--ink-3)] tabular-nums hidden sm:table-cell">
                    {fmtElev(wp.elevation_ft)}
                  </td>
                  <td className="text-right py-2.5 px-2 text-[var(--ink-3)] tabular-nums hidden sm:table-cell">
                    {fmtGain(wp.gain_ft)}
                  </td>
                  <td className="text-right py-2.5 px-2 tabular-nums hidden sm:table-cell">
                    {fmtDist(wp.dist_mi)}
                  </td>
                  <td className="text-right py-2.5 px-2 tabular-nums font-medium text-[var(--ink-2)]">
                    {fmtDist(wp.total_dist_mi)}
                  </td>
                  <td className="text-right py-2.5 px-2 tabular-nums font-mono font-medium text-[var(--ink-2)]">
                    {wp.time ?? "—"}
                  </td>
                  <td className="py-2.5 pl-2 text-amber-700 text-[10px] hidden sm:table-cell">
                    {wp.escape ?? ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
