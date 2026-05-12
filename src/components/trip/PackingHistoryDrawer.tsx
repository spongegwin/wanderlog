"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ActivityEvent, Participant } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity";
import Avatar from "@/components/ui/Avatar";
import { X, RotateCcw } from "lucide-react";

interface PackingHistoryDrawerProps {
  tripId: string;
  currentUserId: string | null;
  currentUserName: string | null;
  participants: Participant[];
  onClose: () => void;
  onRestored: () => void;
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

export default function PackingHistoryDrawer({
  tripId,
  currentUserId,
  currentUserName,
  participants,
  onClose,
  onRestored,
}: PackingHistoryDrawerProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase
      .from("activity_log")
      .select("*")
      .eq("trip_id", tripId)
      .like("action", "packing.%")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setEvents((data ?? []) as ActivityEvent[]);
        setLoading(false);
      });
  }, [tripId]);

  const participantsByUserId = new Map(
    participants.filter((p) => p.user_id).map((p) => [p.user_id!, p])
  );

  async function restore(event: ActivityEvent) {
    if (!event.target_id || !currentUserId) return;
    setRestoringId(event.id);
    try {
      // Look up the item label first (might be a soft-deleted row)
      const { data: item } = await supabase
        .from("packing_items")
        .select("label")
        .eq("id", event.target_id)
        .maybeSingle();

      const { error } = await supabase
        .from("packing_items")
        .update({ deleted_at: null })
        .eq("id", event.target_id);

      if (!error && item) {
        await logActivity(supabase, {
          tripId,
          userId: currentUserId,
          actorName: currentUserName,
          action: "packing.restored",
          targetId: event.target_id,
          summary: `restored ${item.label}`,
        });
        // Refetch the list of events to include this restore
        const { data: fresh } = await supabase
          .from("activity_log")
          .select("*")
          .eq("trip_id", tripId)
          .like("action", "packing.%")
          .order("created_at", { ascending: false });
        setEvents((fresh ?? []) as ActivityEvent[]);
        onRestored();
      }
    } finally {
      setRestoringId(null);
    }
  }

  // Determine which removal events are currently restorable (item still soft-deleted)
  const [restorableIds, setRestorableIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    const removalTargetIds = events
      .filter((e) => e.action === "packing.removed" && e.target_id)
      .map((e) => e.target_id!);
    if (removalTargetIds.length === 0) {
      setRestorableIds(new Set());
      return;
    }
    supabase
      .from("packing_items")
      .select("id, deleted_at")
      .in("id", removalTargetIds)
      .then(({ data }) => {
        const set = new Set<string>();
        for (const row of data ?? []) {
          if ((row as { deleted_at: string | null }).deleted_at != null) {
            set.add((row as { id: string }).id);
          }
        }
        setRestorableIds(set);
      });
  }, [events]);

  const drawer = (
    <div
      className="fixed inset-0 z-[100] bg-black/30 flex justify-end"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md h-full overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-[var(--paper-3)] px-5 py-3 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-[var(--ink)]">Packing history</h2>
            <p className="text-xs text-[var(--ink-3)]">Every change, attributed</p>
          </div>
          <button onClick={onClose} className="text-[var(--ink-3)] hover:text-[var(--ink)] p-1">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--ink-3)] text-center py-12">Loading…</p>
        ) : events.length === 0 ? (
          <div className="text-center py-12 px-6">
            <p className="text-sm text-[var(--ink-3)]">No packing changes yet.</p>
            <p className="text-xs text-[var(--ink-3)] mt-1">
              Every add, rename, removal, and restore will appear here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--paper-2)]">
            {events.map((e) => {
              const p = e.user_id ? participantsByUserId.get(e.user_id) : null;
              const canRestore =
                e.action === "packing.removed" && e.target_id && restorableIds.has(e.target_id);
              return (
                <li key={e.id} className="flex items-start gap-2.5 px-5 py-3">
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
                  {canRestore && (
                    <button
                      onClick={() => restore(e)}
                      disabled={restoringId === e.id}
                      className="flex items-center gap-1 text-xs text-[var(--accent)] hover:bg-[var(--paper-2)] px-2 py-1 rounded disabled:opacity-50"
                    >
                      <RotateCcw size={11} />
                      Restore
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );

  if (typeof window === "undefined") return null;
  return createPortal(drawer, document.body);
}
