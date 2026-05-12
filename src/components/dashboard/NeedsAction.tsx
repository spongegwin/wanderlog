"use client";

import { useState } from "react";
import type { ItineraryBlock, Participant, BlockBooking } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { daysUntil } from "@/lib/utils";
import { AlertTriangle, Check, X, ArrowRight } from "lucide-react";

interface NeedsActionProps {
  blocks: ItineraryBlock[];
  participants: Participant[];
  bookings: BlockBooking[];
  tripStartDate: string | null;
  currentUserId: string | null;
  currentUserName: string | null;
  onRefresh: () => void;
}

type ActionRow =
  | { kind: "rsvp"; block: ItineraryBlock; label: string }
  | { kind: "decision"; block: ItineraryBlock; label: string; sub: string }
  | { kind: "deadline"; block: ItineraryBlock; label: string; sub: string; daysLeft: number };

export default function NeedsAction({
  blocks,
  participants,
  bookings,
  tripStartDate,
  currentUserId,
  currentUserName,
  onRefresh,
}: NeedsActionProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const supabase = createClient();
  const daysToTrip = daysUntil(tripStartDate);

  const bookedBlockIds = new Set(
    bookings.filter((b) => b.user_id === currentUserId).map((b) => b.block_id)
  );

  const actions: ActionRow[] = [];

  for (const block of blocks) {
    // RSVP: confirmed block where current user hasn't said they're in
    if (
      block.status === "confirmed" &&
      currentUserId &&
      !bookedBlockIds.has(block.id)
    ) {
      actions.push({
        kind: "rsvp",
        block,
        label: `Are you coming to ${block.title}?`,
      });
    }

    // Decision: suggested block (any time)
    if (block.status === "suggested") {
      const sub =
        daysToTrip !== null && daysToTrip >= 0
          ? `${daysToTrip} days until the trip`
          : "Awaiting decision";
      actions.push({
        kind: "decision",
        block,
        label: `Decide: ${block.title}`,
        sub,
      });
    }

    // Cancel deadline within 7 days
    if (block.cancel_deadline) {
      const daysLeft = daysUntil(block.cancel_deadline);
      if (daysLeft !== null && daysLeft <= 7 && daysLeft >= 0) {
        const cancelDateStr = new Date(block.cancel_deadline + "T00:00:00").toLocaleDateString(
          undefined,
          { month: "short", day: "numeric" }
        );
        actions.push({
          kind: "deadline",
          block,
          label: `Free to cancel ${block.title} until ${cancelDateStr}`,
          sub: daysLeft === 0 ? "Today" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`,
          daysLeft,
        });
      }
    }
  }

  async function rsvpYes(block: ItineraryBlock) {
    if (!currentUserId) return;
    setBusyId(block.id);
    try {
      await supabase.from("block_bookings").insert({
        block_id: block.id,
        user_id: currentUserId,
        name: currentUserName,
      } as Record<string, unknown>);
      onRefresh();
    } finally {
      setBusyId(null);
    }
  }

  async function rsvpNo(block: ItineraryBlock) {
    // For now, "skip this one" is a no-op (no opt-out persistence).
    // It still calls onRefresh so the row disappears if any state changed.
    void block;
    onRefresh();
  }

  async function markConfirmed(block: ItineraryBlock) {
    setBusyId(block.id);
    try {
      await supabase
        .from("itinerary_blocks")
        .update({ status: "confirmed" })
        .eq("id", block.id);
      onRefresh();
    } finally {
      setBusyId(null);
    }
  }

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border border-[var(--paper-3)] rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 bg-[var(--paper-2)] border-b border-[var(--paper-3)]">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-2)]">
          Needs your attention · {actions.length}
        </p>
      </div>
      <div className="divide-y divide-[var(--paper-2)]">
        {actions.map((a, i) => (
          <div key={i} className="px-4 py-3 flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--ink)]">{a.label}</p>
              {"sub" in a && (
                <p className="text-xs text-[var(--ink-3)] mt-0.5 flex items-center gap-1">
                  {a.kind === "deadline" && a.daysLeft <= 2 && (
                    <AlertTriangle size={11} className="text-red-600" />
                  )}
                  {a.sub}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {a.kind === "rsvp" && (
                <>
                  <button
                    onClick={() => rsvpYes(a.block)}
                    disabled={busyId === a.block.id}
                    className="text-xs bg-[var(--green)] text-white px-3 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-1"
                  >
                    <Check size={12} />
                    Yes, count me in
                  </button>
                  <button
                    onClick={() => rsvpNo(a.block)}
                    className="text-xs text-[var(--ink-3)] hover:text-[var(--ink)] px-2 py-1.5 rounded-lg flex items-center gap-1"
                  >
                    <X size={12} />
                    Skip
                  </button>
                </>
              )}
              {a.kind === "decision" && (
                <button
                  onClick={() => markConfirmed(a.block)}
                  disabled={busyId === a.block.id}
                  className="text-xs bg-[var(--accent)] text-white px-3 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-1"
                >
                  <Check size={12} />
                  Mark confirmed
                </button>
              )}
              {a.kind === "deadline" && a.block.booking_link && (
                <a
                  href={a.block.booking_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs bg-[var(--paper-2)] text-[var(--ink-2)] px-3 py-1.5 rounded-lg hover:bg-[var(--paper-3)] flex items-center gap-1"
                >
                  Open booking
                  <ArrowRight size={11} />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
