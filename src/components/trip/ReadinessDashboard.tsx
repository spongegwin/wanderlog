"use client";

import { useEffect, useState } from "react";
import type {
  Trip,
  ItineraryBlock,
  Participant,
  BlockBooking,
  PackingItem,
} from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { daysUntil } from "@/lib/utils";
import Avatar from "@/components/ui/Avatar";
import GroupLinks from "./GroupLinks";
import { AlertTriangle, Sparkles } from "lucide-react";

interface ReadinessDashboardProps {
  trip: Trip;
  blocks: ItineraryBlock[];
  participants: Participant[];
  bookings: BlockBooking[];
  currentUserId: string | null;
  currentUserName: string | null;
}

export default function ReadinessDashboard({
  trip,
  blocks,
  participants,
  bookings,
  currentUserId,
  currentUserName,
}: ReadinessDashboardProps) {
  const [packing, setPacking] = useState<PackingItem[]>([]);
  const [loadingPacking, setLoadingPacking] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    supabase
      .from("packing_items")
      .select("*")
      .eq("trip_id", trip.id)
      .is("deleted_at", null)
      .then(({ data }) => {
        setPacking((data ?? []) as PackingItem[]);
        setLoadingPacking(false);
      });
  }, [trip.id]);

  // ---- Score & countdown ----
  const today = new Date().toISOString().slice(0, 10);
  const daysToStart = daysUntil(trip.start_date);
  const daysToEnd = daysUntil(trip.end_date);

  let phaseText = "";
  let phaseAccent = "text-[var(--ink-3)]";
  if (trip.start_date && trip.end_date) {
    if (today >= trip.start_date && today <= trip.end_date) {
      phaseText = "Trip in progress";
      phaseAccent = "text-[var(--green)]";
    } else if (today > trip.end_date) {
      phaseText = "Trip complete";
      phaseAccent = "text-[var(--ink-3)]";
    } else if (daysToStart !== null) {
      phaseText = daysToStart === 1 ? "1 day until trip" : `${daysToStart} days until trip`;
      phaseAccent = daysToStart <= 7 ? "text-[var(--accent)]" : "text-[var(--ink-2)]";
    }
  } else {
    phaseText = "No dates set";
  }

  // Confirmed blocks (exclude idea blocks from readiness counts)
  const nonIdeaBlocks = blocks.filter((b) => b.status !== "idea");
  const confirmedBlocks = blocks.filter((b) => b.status === "confirmed");
  const blocksScore =
    nonIdeaBlocks.length === 0 ? 0 : confirmedBlocks.length / nonIdeaBlocks.length;

  // RSVPs: for each confirmed block where everyone should show up, expect 1 booking per participant
  const rsvpRelevantBlocks = confirmedBlocks; // simple v1: every confirmed block expects everyone
  const expectedRsvps = rsvpRelevantBlocks.length * participants.length;
  const actualRsvps = bookings.filter((b) =>
    rsvpRelevantBlocks.some((blk) => blk.id === b.block_id)
  ).length;
  const rsvpScore = expectedRsvps === 0 ? 1 : actualRsvps / expectedRsvps;

  // Packing
  const totalPacking = packing.length;
  const packedCount = packing.filter((p) => p.packed).length;
  const packingScore = totalPacking === 0 ? 0 : packedCount / totalPacking;

  let score = 0.4 * blocksScore + 0.3 * rsvpScore + 0.3 * packingScore;

  // Penalty for overdue cancel deadlines on still-suggested blocks
  const overdue = blocks.filter(
    (b) =>
      b.status === "suggested" &&
      b.cancel_deadline &&
      new Date(b.cancel_deadline + "T00:00:00") < new Date()
  ).length;
  score = Math.max(0, score - 0.05 * overdue);

  const readinessPct = Math.round(score * 100);

  // Bar color based on score
  const barColor =
    readinessPct >= 80
      ? "bg-[var(--green)]"
      : readinessPct >= 50
      ? "bg-[var(--accent)]"
      : "bg-amber-500";

  // ---- This week (top 3 actions) ----
  type WeekItem = {
    label: string;
    sub: string;
    urgent: boolean;
  };

  const weekItems: WeekItem[] = [];
  // Suggested blocks needing decisions
  for (const b of blocks) {
    if (b.status === "suggested") {
      let urgent = false;
      let sub = "Awaiting decision";
      if (b.cancel_deadline) {
        const d = daysUntil(b.cancel_deadline);
        if (d !== null && d <= 7 && d >= 0) {
          sub = d === 0 ? "Cancel deadline today" : `${d} day${d === 1 ? "" : "s"} until cancel deadline`;
          urgent = d <= 2;
        }
      }
      weekItems.push({ label: `Decide: ${b.title}`, sub, urgent });
    }
  }
  // Confirmed blocks where current user hasn't RSVP'd
  const myBookings = new Set(bookings.filter((b) => b.user_id === currentUserId).map((b) => b.block_id));
  for (const b of confirmedBlocks) {
    if (currentUserId && !myBookings.has(b.id)) {
      weekItems.push({ label: `Are you coming to ${b.title}?`, sub: "Quick RSVP needed", urgent: false });
      break; // only surface one of these to avoid noise
    }
  }
  // Cancel deadlines within 7 days
  for (const b of blocks) {
    if (b.cancel_deadline && b.status !== "completed") {
      const d = daysUntil(b.cancel_deadline);
      if (d !== null && d <= 7 && d >= 0 && !weekItems.some((w) => w.label.includes(b.title))) {
        weekItems.push({
          label: `Free to cancel ${b.title}`,
          sub: d === 0 ? "Today" : `${d} day${d === 1 ? "" : "s"} left`,
          urgent: d <= 2,
        });
      }
    }
  }
  weekItems.sort((a, b) => (a.urgent === b.urgent ? 0 : a.urgent ? -1 : 1));
  const topActions = weekItems.slice(0, 3);

  // ---- Per-participant ----
  type ParticipantRow = {
    p: Participant;
    confirmedAttended: number;
    confirmedTotal: number;
    sharedClaimed: number;
    sharedTotal: number;
  };
  const sharedItems = packing.filter((p) => (p.scope ?? "shared") === "shared");
  const participantRows: ParticipantRow[] = participants.map((p) => {
    const userId = p.user_id;
    const confirmedAttended = userId
      ? bookings.filter(
          (b) =>
            b.user_id === userId &&
            confirmedBlocks.some((blk) => blk.id === b.block_id)
        ).length
      : 0;
    const sharedClaimed = sharedItems.filter((i) => i.assigned_to === p.id).length;
    return {
      p,
      confirmedAttended,
      confirmedTotal: confirmedBlocks.length,
      sharedClaimed,
      sharedTotal: sharedItems.length,
    };
  });

  return (
    <div className="space-y-5">
      {/* Hero strip */}
      <div className="bg-white border border-[var(--paper-3)] rounded-2xl px-5 py-4">
        <div className="flex items-baseline justify-between flex-wrap gap-2 mb-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">
              Readiness
            </p>
            <p className="font-serif text-3xl font-bold text-[var(--ink)] leading-none mt-0.5">
              {readinessPct}%
            </p>
          </div>
          <div className="text-right">
            <p className={`text-sm font-medium ${phaseAccent}`}>{phaseText}</p>
            {trip.start_date && trip.end_date && (
              <p className="text-xs text-[var(--ink-3)]">
                {trip.name} ·{" "}
                {new Date(trip.start_date + "T00:00:00").toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
                {" – "}
                {new Date(trip.end_date + "T00:00:00").toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </p>
            )}
          </div>
        </div>
        <div className="h-2 bg-[var(--paper-2)] rounded-full overflow-hidden">
          <div
            className={`h-full ${barColor} transition-all duration-500`}
            style={{ width: `${readinessPct}%` }}
          />
        </div>
        {overdue > 0 && (
          <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
            <AlertTriangle size={11} />
            {overdue} block{overdue === 1 ? "" : "s"} past cancel deadline (−{5 * overdue}%)
          </p>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Blocks confirmed"
          value={confirmedBlocks.length}
          total={nonIdeaBlocks.length}
          hint={
            nonIdeaBlocks.length === 0
              ? "Nothing planned yet"
              : `${nonIdeaBlocks.length - confirmedBlocks.length} still pending`
          }
        />
        <StatCard
          label="RSVPs locked"
          value={actualRsvps}
          total={expectedRsvps}
          hint={
            expectedRsvps === 0
              ? "—"
              : actualRsvps === expectedRsvps
              ? "Everyone's in"
              : `${expectedRsvps - actualRsvps} pending`
          }
        />
        <StatCard
          label="Packed"
          value={packedCount}
          total={totalPacking}
          hint={
            loadingPacking
              ? "…"
              : totalPacking === 0
              ? "List is empty"
              : packedCount === totalPacking
              ? "All packed"
              : `${totalPacking - packedCount} to go`
          }
        />
      </div>

      {/* This week */}
      <section className="bg-white border border-[var(--paper-3)] rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[var(--paper-3)] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--ink)]">This week</h3>
          {topActions.length > 0 && (
            <span className="text-xs text-[var(--ink-3)]">{topActions.length}</span>
          )}
        </div>
        {topActions.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-[var(--ink-3)] italic">
              <Sparkles size={12} className="inline mr-1 text-[var(--accent)]" />
              Nothing urgent — keep adding ideas.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--paper-2)]">
            {topActions.map((a, i) => (
              <li key={i} className="px-4 py-2.5 flex items-start gap-2">
                {a.urgent && (
                  <AlertTriangle size={13} className="text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--ink)]">{a.label}</p>
                  <p className="text-xs text-[var(--ink-3)] mt-0.5">{a.sub}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Per-participant strip */}
      {participantRows.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)] mb-2 px-1">
            Who&apos;s ready
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {participantRows.map((row) => {
              const { p, confirmedAttended, confirmedTotal, sharedClaimed, sharedTotal } = row;
              return (
                <div
                  key={p.id}
                  className="bg-white border border-[var(--paper-3)] rounded-xl px-3 py-2.5 flex items-center gap-3"
                >
                  <Avatar name={p.name} color={p.color} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--ink)] truncate">
                      {p.name ?? "Unnamed"}
                      <span className="text-xs text-[var(--ink-3)] font-normal ml-1">
                        · {p.role}
                      </span>
                    </p>
                    <p className="text-xs text-[var(--ink-3)] mt-0.5">
                      RSVPs {confirmedAttended}/{confirmedTotal}
                      {sharedTotal > 0 && (
                        <>
                          {" · "}
                          Shared gear {sharedClaimed}/{sharedTotal}
                        </>
                      )}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Group links */}
      <GroupLinks
        tripId={trip.id}
        participants={participants}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  total,
  hint,
}: {
  label: string;
  value: number;
  total: number;
  hint: string;
}) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div className="bg-white border border-[var(--paper-3)] rounded-xl px-4 py-3">
      <p className="text-xs font-medium text-[var(--ink-3)] uppercase tracking-wide">{label}</p>
      <p className="font-serif text-2xl font-bold text-[var(--ink)] mt-1 leading-none tabular-nums">
        {value}
        <span className="text-base text-[var(--ink-3)] font-normal"> / {total}</span>
      </p>
      <div className="h-1 bg-[var(--paper-2)] rounded-full mt-2 overflow-hidden">
        <div
          className="h-full bg-[var(--ink-2)] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-[var(--ink-3)] mt-1.5">{hint}</p>
    </div>
  );
}
