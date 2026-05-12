"use client";

import { useEffect, useState } from "react";
import type { ActivityEvent, Participant } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

interface PackingItemHistoryProps {
  itemId: string;
  participants: Participant[];
  onClose: () => void;
}

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function PackingItemHistory({
  itemId,
  participants,
  onClose,
}: PackingItemHistoryProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    supabase
      .from("activity_log")
      .select("*")
      .eq("target_id", itemId)
      .like("action", "packing.%")
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setEvents((data ?? []) as ActivityEvent[]);
        setLoading(false);
      });
  }, [itemId]);

  const byUserId = new Map(participants.filter((p) => p.user_id).map((p) => [p.user_id!, p]));

  return (
    <div
      className="absolute right-0 top-full mt-1 w-72 bg-white border border-[var(--paper-3)] rounded-lg shadow-md py-2 z-20"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-1 border-b border-[var(--paper-3)] flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">
          Item history
        </p>
        <button onClick={onClose} className="text-[var(--ink-3)] text-xs hover:text-[var(--ink)]">
          Close
        </button>
      </div>
      <div className="max-h-60 overflow-y-auto">
        {loading ? (
          <p className="text-xs text-[var(--ink-3)] px-3 py-3">Loading…</p>
        ) : events.length === 0 ? (
          <p className="text-xs text-[var(--ink-3)] px-3 py-3">No tracked changes yet.</p>
        ) : (
          <ul className="space-y-1 px-3 py-2">
            {events.map((e) => {
              const p = e.user_id ? byUserId.get(e.user_id) : null;
              return (
                <li key={e.id} className="text-xs text-[var(--ink-2)]">
                  <span className="font-medium text-[var(--ink)]">
                    {p?.name ?? e.actor_name ?? "Someone"}
                  </span>{" "}
                  {e.summary}
                  <span className="text-[var(--ink-3)]"> · {relativeTime(e.created_at)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
