"use client";

import { useState } from "react";
import type { ItineraryBlock, Trip } from "@/lib/types";
import StatusBadge from "@/components/ui/StatusBadge";
import { ChevronLeft, ChevronRight } from "lucide-react";

const TYPE_LABEL: Record<string, string> = {
  flight: "Flight", stay: "Stay", activity: "Activity", meal: "Meal",
  transport: "Transport", hike: "Hike", rest: "Rest", idea: "Idea",
};

const TYPE_DOT: Record<string, string> = {
  hike: "bg-[var(--green)]",
  stay: "bg-[var(--green)]",
  flight: "bg-[var(--sky)]",
  transport: "bg-[var(--sky)]",
  activity: "bg-[var(--accent)]",
  meal: "bg-[var(--accent-2)]",
  idea: "bg-[var(--paper-3)]",
  rest: "bg-[var(--paper-3)]",
};

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric",
  });
}

interface TodayViewProps {
  trip: Trip;
  blocks: ItineraryBlock[];
}

export default function TodayView({ trip, blocks }: TodayViewProps) {
  const today = new Date().toISOString().slice(0, 10);

  // Default day: today if in range, else trip start, else first date present in blocks
  const defaultDay = (() => {
    if (trip.start_date && trip.end_date) {
      if (today >= trip.start_date && today <= trip.end_date) return today;
      return trip.start_date;
    }
    const datedBlock = blocks.find((b) => b.date);
    return datedBlock?.date ?? today;
  })();

  const [selectedDate, setSelectedDate] = useState<string>(defaultDay);

  const dayBlocks = blocks
    .filter((b) => b.date === selectedDate)
    .sort((a, b) => a.sort_order - b.sort_order);

  const canGoBack = !trip.start_date || selectedDate > trip.start_date;
  const canGoForward = !trip.end_date || selectedDate < trip.end_date;

  return (
    <div className="space-y-4">
      {/* Day picker */}
      <div className="flex items-center justify-between bg-white border border-[var(--paper-3)] rounded-xl px-3 py-2">
        <button
          onClick={() => setSelectedDate((d) => addDays(d, -1))}
          disabled={!canGoBack}
          className="p-2 text-[var(--ink-3)] hover:text-[var(--ink)] disabled:opacity-30"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <p className="font-serif text-lg font-semibold text-[var(--ink)]">
            {formatDate(selectedDate)}
          </p>
          {selectedDate === today && (
            <p className="text-[10px] uppercase tracking-wide text-[var(--accent)] font-semibold">
              Today
            </p>
          )}
        </div>
        <button
          onClick={() => setSelectedDate((d) => addDays(d, 1))}
          disabled={!canGoForward}
          className="p-2 text-[var(--ink-3)] hover:text-[var(--ink)] disabled:opacity-30"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {dayBlocks.length === 0 ? (
        <p className="text-sm text-[var(--ink-3)] text-center py-12">
          Nothing scheduled for this day.
        </p>
      ) : (
        <div className="space-y-2">
          {dayBlocks.map((b) => {
            const dot = TYPE_DOT[b.type] ?? "bg-[var(--ink-3)]";
            const isTransport = b.type === "transport" || b.type === "flight";
            const isHike = b.type === "hike";
            return (
              <div
                key={b.id}
                className="bg-white border border-[var(--paper-3)] rounded-xl p-4"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5 ${dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-3)]">
                        {TYPE_LABEL[b.type] ?? b.type}
                      </span>
                      <StatusBadge status={b.status} />
                    </div>
                    <p className="font-semibold text-[var(--ink)] mt-1 text-base leading-tight">
                      {b.title}
                    </p>
                    {isTransport && (b.from_location || b.to_location) && (
                      <p className="text-sm text-[var(--ink-2)] mt-0.5">
                        {b.from_location ?? "?"} → {b.to_location ?? "?"}
                      </p>
                    )}
                    {isHike && (b.hike_start || b.hike_end) && (
                      <p className="text-sm text-[var(--ink-2)] mt-0.5">
                        {b.hike_start} → {b.hike_end}
                      </p>
                    )}
                    {b.subtitle && (
                      <p className="text-sm text-[var(--ink-3)] mt-1">{b.subtitle}</p>
                    )}
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-[var(--ink-3)]">
                      {b.hike_distance && <span>{b.hike_distance}</span>}
                      {b.hike_elev_gain && <span>↑ {b.hike_elev_gain}</span>}
                      {b.hike_est_hours && <span>{b.hike_est_hours}</span>}
                      {b.distance_mi && <span>{b.distance_mi} mi</span>}
                      {b.duration_min && (
                        <span>
                          {Math.floor(b.duration_min / 60)}h {b.duration_min % 60}m
                        </span>
                      )}
                      {b.cost_amount && (
                        <span>
                          {b.cost_currency} {b.cost_amount.toLocaleString()}
                        </span>
                      )}
                      {b.booking_conf && (
                        <span className="font-mono">#{b.booking_conf}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
