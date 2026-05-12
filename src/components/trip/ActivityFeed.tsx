"use client";

import { useEffect, useState } from "react";
import type { ActivityEvent, Participant } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/ui/Avatar";
import { ChevronDown, ChevronUp, Activity } from "lucide-react";

interface ActivityFeedProps {
  tripId: string;
  participants: Participant[];
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

export default function ActivityFeed({ tripId, participants }: ActivityFeedProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [open, setOpen] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    supabase
      .from("activity_log")
      .select("*")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => setEvents((data ?? []) as ActivityEvent[]));
  }, [tripId, open]);

  if (events.length === 0 && !open) {
    // Don't render at all if no activity yet
    return null;
  }

  const participantsByUserId = new Map(
    participants.filter((p) => p.user_id).map((p) => [p.user_id!, p])
  );

  return (
    <div className="bg-white border border-[var(--paper-3)] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-[var(--paper-2)] transition"
      >
        <div className="flex items-center gap-2 text-[var(--ink-2)]">
          <Activity size={13} className="text-[var(--ink-3)]" />
          <span className="text-xs font-semibold uppercase tracking-wide">
            Activity {events.length > 0 && <span className="opacity-60">· {events.length}</span>}
          </span>
        </div>
        <div className="text-[var(--ink-3)]">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {open && (
        <div className="border-t border-[var(--paper-3)] max-h-64 overflow-y-auto">
          {events.length === 0 ? (
            <p className="text-xs text-[var(--ink-3)] text-center py-6">No activity yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--paper-2)]">
              {events.map((e) => {
                const p = e.user_id ? participantsByUserId.get(e.user_id) : null;
                return (
                  <li key={e.id} className="flex items-start gap-2.5 px-4 py-2.5">
                    <Avatar
                      name={p?.name ?? e.actor_name}
                      color={p?.color ?? null}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--ink-2)] leading-snug">
                        <span className="font-medium text-[var(--ink)]">
                          {e.actor_name ?? "Someone"}
                        </span>{" "}
                        {e.summary}
                      </p>
                      <p className="text-[10px] text-[var(--ink-3)] mt-0.5">
                        {relativeTime(e.created_at)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
