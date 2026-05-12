"use client";

import { useState } from "react";
import type { HikeWaypoint, ItineraryBlock } from "@/lib/types";
import WaypointTable from "@/components/itinerary/WaypointTable";
import { ChevronDown, ChevronRight } from "lucide-react";

const TYPE_LABEL: Record<string, string> = {
  flight: "Flight", stay: "Stay", activity: "Activity", meal: "Meal",
  transport: "Transport", idea: "Idea", hike: "Hike", rest: "Rest",
};

const TYPE_DOT: Record<string, string> = {
  hike: "bg-[var(--green)]",
  stay: "bg-[var(--green)]",
  flight: "bg-[var(--sky)]",
  activity: "bg-[var(--accent)]",
  meal: "bg-[var(--accent-2)]",
  transport: "bg-[var(--ink-3)]",
  idea: "bg-[var(--paper-3)]",
  rest: "bg-[var(--paper-3)]",
};

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmed",
  suggested: "Suggested",
  idea: "Idea",
  completed: "Done",
};

const STATUS_COLOR: Record<string, string> = {
  confirmed: "text-[var(--green)] bg-green-50",
  suggested: "text-amber-700 bg-amber-50",
  idea: "text-[var(--ink-3)] bg-[var(--paper-2)]",
  completed: "text-[var(--ink-3)] bg-[var(--paper-2)]",
};

interface TripTableViewProps {
  blocks: ItineraryBlock[];
}

export default function TripTableView({ blocks }: TripTableViewProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    const y = window.scrollY;
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "instant" }));
  }

  if (!blocks.length) {
    return <p className="text-sm text-[var(--ink-3)] text-center py-12">No blocks yet.</p>;
  }

  // Sort by date (asc, nulls last), then sort_order
  const sortedBlocks = [...blocks].sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date) || a.sort_order - b.sort_order;
    if (a.date && !b.date) return -1;
    if (!a.date && b.date) return 1;
    return a.sort_order - b.sort_order;
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-xs font-medium text-[var(--ink-3)] border-b border-[var(--paper-3)]">
            <th className="w-6" />
            <th className="py-2 pr-4 whitespace-nowrap">Day</th>
            <th className="py-2 pr-4">Type</th>
            <th className="py-2 pr-4">Title</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4 hidden sm:table-cell">Details</th>
          </tr>
        </thead>
        <tbody>
          {sortedBlocks.map((b) => {
            const dot = TYPE_DOT[b.type] ?? "bg-[var(--ink-3)]";
            const statusStyle = STATUS_COLOR[b.status] ?? STATUS_COLOR.idea;
            const isExpanded = expandedIds.has(b.id);
            const isHike = b.type === "hike";
            const waypoints = Array.isArray(b.hike_waypoints) ? (b.hike_waypoints as HikeWaypoint[]) : [];
            const canExpand =
              (isHike && waypoints.length > 0) ||
              !!b.subtitle ||
              !!b.booking_conf ||
              !!b.booking_details ||
              !!b.booking_link ||
              !!b.cancel_deadline;

            const details: string[] = [];
            if (b.hike_distance) details.push(b.hike_distance);
            if (b.hike_elev_gain) details.push(`↑ ${b.hike_elev_gain}`);
            if (b.hike_est_hours) details.push(b.hike_est_hours);
            if (b.distance_mi) details.push(`${b.distance_mi} mi`);
            if (b.duration_min) {
              const h = Math.floor(b.duration_min / 60);
              const m = b.duration_min % 60;
              details.push(h > 0 ? `${h}h ${m}m` : `${m}m`);
            }
            if (b.cost_amount) details.push(`${b.cost_currency} ${b.cost_amount.toLocaleString()}`);
            if (b.booking_conf) details.push(`#${b.booking_conf}`);

            return (
              <RowGroup
                key={b.id}
                block={b}
                isExpanded={isExpanded}
                canExpand={canExpand}
                isHike={isHike}
                waypoints={waypoints}
                dot={dot}
                statusStyle={statusStyle}
                details={details}
                onToggle={() => toggle(b.id)}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface RowGroupProps {
  block: ItineraryBlock;
  isExpanded: boolean;
  canExpand: boolean;
  isHike: boolean;
  waypoints: HikeWaypoint[];
  dot: string;
  statusStyle: string;
  details: string[];
  onToggle: () => void;
}

function RowGroup({
  block: b,
  isExpanded,
  canExpand,
  isHike,
  waypoints,
  dot,
  statusStyle,
  details,
  onToggle,
}: RowGroupProps) {
  return (
    <>
      <tr
        role="button"
        tabIndex={canExpand ? 0 : -1}
        onClick={() => canExpand && onToggle()}
        onKeyDown={(e) => {
          if (canExpand && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onToggle();
          }
        }}
        className={`border-b border-[var(--paper-2)] transition-colors ${
          canExpand ? "cursor-pointer hover:bg-[var(--paper-2)]" : ""
        }`}
      >
        <td className="py-2.5 pl-1 pr-1 text-[var(--ink-3)]">
          {canExpand &&
            (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
        </td>
        <td className="py-2.5 pr-4 whitespace-nowrap text-xs text-[var(--ink-3)]">
          {b.date
            ? new Date(b.date + "T00:00:00").toLocaleDateString(undefined, {
                weekday: "short", month: "short", day: "numeric",
              })
            : b.day_label ?? "—"}
        </td>
        <td className="py-2.5 pr-4">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
            <span className="text-xs text-[var(--ink-2)]">{TYPE_LABEL[b.type] ?? b.type}</span>
          </div>
        </td>
        <td className="py-2.5 pr-4 font-medium text-[var(--ink)]">
          {b.title}
          {(b.from_location || b.to_location) && (
            <span className="block text-xs font-normal text-[var(--ink-2)] mt-0.5">
              {b.from_location} → {b.to_location}
            </span>
          )}
          {b.subtitle && (
            <span className="block text-xs font-normal text-[var(--ink-3)] mt-0.5 line-clamp-1">
              {b.subtitle}
            </span>
          )}
        </td>
        <td className="py-2.5 pr-4">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusStyle}`}>
            {STATUS_LABEL[b.status] ?? b.status}
          </span>
        </td>
        <td className="py-2.5 pr-4 text-xs text-[var(--ink-3)] hidden sm:table-cell">
          {details.join(" · ") || "—"}
        </td>
      </tr>

      {isExpanded && canExpand && (
        <tr className="bg-[var(--paper-2)] bg-opacity-40">
          <td />
          <td colSpan={5} className="px-2 py-4 pl-2">
            <div className="space-y-3 pl-1">
              {isHike && waypoints.length > 0 && (
                <div className="bg-white rounded-lg p-3 border border-[var(--paper-3)]">
                  <WaypointTable waypoints={waypoints} />
                </div>
              )}

              {!isHike && b.subtitle && (
                <p className="text-sm text-[var(--ink-2)]">{b.subtitle}</p>
              )}

              {b.booking_details && (
                <p className="text-sm text-[var(--ink-2)]">{b.booking_details}</p>
              )}

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--ink-3)]">
                {b.booking_conf && (
                  <span>
                    Ref: <span className="font-mono text-[var(--ink-2)]">{b.booking_conf}</span>
                  </span>
                )}
                {b.cancel_deadline && (
                  <span className="text-amber-700">
                    Cancel by {new Date(b.cancel_deadline).toLocaleDateString()}
                  </span>
                )}
                {b.booking_link && (
                  <a
                    href={b.booking_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--sky)] underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View booking →
                  </a>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
