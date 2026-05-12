"use client";

import { useEffect, useState } from "react";
import { useParams, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Trip, ItineraryBlock, Participant, BlockBooking, BlockStatus } from "@/lib/types";
import TripHeader from "@/components/trip/TripHeader";
import TripTableView from "@/components/trip/TripTableView";
import ItineraryBlockComponent from "@/components/itinerary/ItineraryBlock";
import AddBlock from "@/components/itinerary/AddBlock";
import AddHikeBlock from "@/components/itinerary/AddHikeBlock";
import ReadinessDashboard from "@/components/trip/ReadinessDashboard";
import NeedsAction from "@/components/dashboard/NeedsAction";
import ActivityFeed from "@/components/trip/ActivityFeed";
import TodayView from "@/components/trip/TodayView";
import PackingList from "@/components/trip/PackingList";
import PlanAssistant from "@/components/itinerary/PlanAssistant";
import BlockBulkEditor from "@/components/itinerary/BlockBulkEditor";
import { logActivity } from "@/lib/activity";
import type { BlockDiff } from "@/lib/block-text";
import { Plus, Sparkles } from "lucide-react";

type Tab = "plan" | "today" | "table" | "packing" | "readiness";
type StatusFilter = "all" | BlockStatus;

const STATUS_FILTERS: StatusFilter[] = ["all", "confirmed", "suggested", "idea"];
const STATUS_LABEL: Record<StatusFilter, string> = {
  all: "All",
  confirmed: "Confirmed",
  suggested: "Suggested",
  idea: "Ideas",
  completed: "Done",
};

export const dynamic = "force-dynamic";

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [blocks, setBlocks] = useState<ItineraryBlock[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [bookings, setBookings] = useState<BlockBooking[]>([]);
  const [tab, setTab] = useState<Tab>("plan");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userColor, setUserColor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [bulkEditTarget, setBulkEditTarget] = useState<{
    date: string | null;
    label: string;
    blocks: ItineraryBlock[];
  } | null>(null);

  async function load() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);

    const [tripRes, blocksRes, participantsRes] = await Promise.all([
      supabase.from("trips").select("*").eq("id", id).single(),
      supabase.from("itinerary_blocks").select("*").eq("trip_id", id).order("sort_order").order("created_at"),
      supabase.from("participants").select("*").eq("trip_id", id),
    ]);

    setTrip(tripRes.data as Trip | null);
    const loadedBlocks = (blocksRes.data ?? []) as ItineraryBlock[];
    const loadedParticipants = (participantsRes.data ?? []) as Participant[];
    setBlocks(loadedBlocks);
    setParticipants(loadedParticipants);

    if (user && loadedParticipants.length) {
      const me = loadedParticipants.find((p) => p.user_id === user.id);
      setUserName(me?.name ?? user.user_metadata?.full_name ?? null);
      setUserColor(me?.color ?? null);
    }

    if (loadedBlocks.length) {
      const blockIds = loadedBlocks.map((b) => b.id);
      const { data: bk } = await supabase.from("block_bookings").select("*").in("block_id", blockIds);
      setBookings((bk ?? []) as BlockBooking[]);
    }

    setLoading(false);
  }

  async function applyDayBulkEdit(result: BlockDiff) {
    if (!userId) return;
    const supabase = createClient();
    const target = bulkEditTarget;
    if (!target) return;

    // Inserts
    if (result.toInsert.length > 0) {
      const rows = result.toInsert.map((t) => ({
        trip_id: id,
        added_by: userId,
        status: t.status,
        type: t.type,
        date: t.date,
        day_label: t.day_label,
        title: t.title,
      }));
      const { data: inserted } = await supabase
        .from("itinerary_blocks")
        .insert(rows as Record<string, unknown>[])
        .select();
      if (inserted) {
        for (const ins of inserted as ItineraryBlock[]) {
          await logActivity(supabase, {
            tripId: id,
            userId,
            actorName: userName,
            action: "block.created",
            targetId: ins.id,
            summary: `added ${ins.title}`,
          });
        }
      }
    }

    // Deletes (hard — FK cascades)
    if (result.toDelete.length > 0) {
      const ids = result.toDelete.map((b) => b.id);
      await supabase.from("itinerary_blocks").delete().in("id", ids);
      for (const b of result.toDelete) {
        await logActivity(supabase, {
          tripId: id,
          userId,
          actorName: userName,
          action: "block.deleted",
          targetId: b.id,
          summary: `deleted ${b.title}`,
        });
      }
    }

    // Updates (status/type only via bulk)
    for (const u of result.toUpdate) {
      await supabase
        .from("itinerary_blocks")
        .update(u.fields as Record<string, unknown>)
        .eq("id", u.id);
      await logActivity(supabase, {
        tripId: id,
        userId,
        actorName: userName,
        action: u.fields.status ? "status.changed" : "block.edited",
        targetId: u.id,
        summary: u.fields.status
          ? `marked ${u.title} as ${u.fields.status}`
          : `edited ${u.title}`,
      });
    }

    const total =
      result.toInsert.length + result.toDelete.length + result.toUpdate.length;
    if (total > 0) {
      await logActivity(supabase, {
        tripId: id,
        userId,
        actorName: userName,
        action: "plan.day_edited",
        summary: `edited ${target.label} (${result.toInsert.length} added, ${result.toDelete.length} removed, ${result.toUpdate.length} changed)`,
      });
    }

    setBulkEditTarget(null);
    await load();
  }

  useEffect(() => {
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-[var(--ink-3)]">Loading…</div>
      </div>
    );
  }

  if (!trip) return notFound();

  const filteredBlocks =
    statusFilter === "all" ? blocks : blocks.filter((b) => b.status === statusFilter);

  // Group by date (preferred) or normalized day_label (fallback). Date drives chronological sort.
  const normalizeDayLabel = (label: string | null): string | null => {
    if (!label) return null;
    return label.replace(/\s+(night|morning|afternoon|evening)s?\s*$/i, "").trim();
  };

  type DayGroup = { key: string; date: string | null; label: string; blocks: ItineraryBlock[] };
  const dayGroups = new Map<string, DayGroup>();
  const noDayBlocks: ItineraryBlock[] = [];
  for (const b of filteredBlocks) {
    const key = b.date ?? normalizeDayLabel(b.day_label);
    if (!key) {
      noDayBlocks.push(b);
      continue;
    }
    if (!dayGroups.has(key)) {
      const label = b.date
        ? new Date(b.date + "T00:00:00").toLocaleDateString(undefined, {
            weekday: "short", month: "short", day: "numeric",
          })
        : key;
      dayGroups.set(key, { key, date: b.date, label, blocks: [] });
    }
    dayGroups.get(key)!.blocks.push(b);
  }

  // Sort: dated groups chronologically, then label-only groups in insertion order
  const days = Array.from(dayGroups.values()).sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.date && !b.date) return -1;
    if (!a.date && b.date) return 1;
    return 0;
  });
  const noBlocks = blocks.length === 0;
  const noFilteredBlocks = filteredBlocks.length === 0 && blocks.length > 0;

  // Distinct day labels across the whole trip (for BlockEditor's quick-select chips)
  const allDayLabels = Array.from(
    new Set(blocks.map((b) => b.day_label).filter(Boolean) as string[])
  );

  return (
    <main className="max-w-4xl mx-auto px-4 py-6">
      <TripHeader
        trip={trip}
        participants={participants}
        blocks={blocks}
        currentUserId={userId}
        currentUserName={userName}
        onUpdated={load}
      />

      <div className="mt-5 space-y-3">
        <NeedsAction
          blocks={blocks}
          participants={participants}
          bookings={bookings}
          tripStartDate={trip.start_date}
          currentUserId={userId}
          currentUserName={userName}
          onRefresh={load}
        />
        <ActivityFeed tripId={id} participants={participants} />
      </div>

      {/* Tab bar + Add button */}
      <div className="flex items-center justify-between mt-6 mb-4">
        <div className="flex gap-1">
          {(["plan", "today", "table", "packing", "readiness"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition capitalize ${
                tab === t
                  ? "bg-[var(--ink)] text-white"
                  : "text-[var(--ink-3)] hover:bg-[var(--paper-3)]"
              }`}
            >
              {t === "plan"
                ? "Plan"
                : t === "today"
                ? "Today"
                : t === "table"
                ? "Table"
                : t === "packing"
                ? "Packing"
                : "Readiness"}
            </button>
          ))}
        </div>

        {userId && (tab === "plan" || tab === "table") && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAssistant(true)}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-[var(--paper-2)] hover:bg-[var(--paper-3)] text-[var(--ink-2)] transition border border-[var(--paper-3)]"
              title="Ask AI for planning help"
            >
              <Sparkles size={14} className="text-[var(--accent)]" />
              Ask AI
            </button>
            <button
              onClick={() => setShowAdd((v) => !v)}
              className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition ${
                showAdd
                  ? "bg-[var(--ink)] text-white"
                  : "bg-[var(--accent)] text-white hover:opacity-90"
              }`}
            >
              <Plus size={14} />
              Add
            </button>
          </div>
        )}
      </div>

      {/* Status filter chips (Plan + Table only) */}
      {(tab === "plan" || tab === "table") && !noBlocks && (
        <div className="flex items-center justify-between gap-2 mb-5 flex-wrap">
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_FILTERS.map((f) => {
              const count = f === "all" ? blocks.length : blocks.filter((b) => b.status === f).length;
              if (f !== "all" && count === 0) return null;
              return (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`text-xs font-medium px-2.5 py-1 rounded-full transition ${
                    statusFilter === f
                      ? "bg-[var(--ink)] text-white"
                      : "bg-[var(--paper-2)] text-[var(--ink-3)] hover:bg-[var(--paper-3)]"
                  }`}
                >
                  {STATUS_LABEL[f]} <span className="opacity-60">{count}</span>
                </button>
              );
            })}
          </div>
          {statusFilter !== "all" && (
            <span className="text-xs text-[var(--ink-3)]">
              Showing {filteredBlocks.length} of {blocks.length}
            </span>
          )}
        </div>
      )}

      {/* Inline add forms (top) */}
      {showAdd && userId && (tab === "plan" || tab === "table") && (
        <div className="space-y-3 mb-6">
          <AddBlock tripId={id} currentUserId={userId} currentUserName={userName} onAdded={() => { load(); setShowAdd(false); }} />
          <AddHikeBlock tripId={id} currentUserId={userId} currentUserName={userName} onAdded={() => { load(); setShowAdd(false); }} />
        </div>
      )}

      {tab === "plan" && (
        <div className="space-y-8">
          {days.map((group, dayIdx) => (
            <section key={group.key}>
              <div className="flex items-baseline gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-serif text-2xl font-bold text-[var(--ink)] leading-none">
                    {dayIdx + 1}
                  </span>
                  <p className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wider leading-none">
                    Day
                  </p>
                </div>
                <div className="h-px flex-1 bg-[var(--paper-3)]" />
                <span className="text-sm text-[var(--ink-3)] font-medium whitespace-nowrap">{group.label}</span>
                {userId && (
                  <button
                    onClick={() =>
                      setBulkEditTarget({
                        date: group.date,
                        label: group.label,
                        blocks: group.blocks,
                      })
                    }
                    className="text-xs text-[var(--ink-3)] hover:text-[var(--accent)] hover:underline transition whitespace-nowrap"
                  >
                    Edit
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {group.blocks.map((b) => (
                  <ItineraryBlockComponent
                    key={b.id}
                    block={b}
                    participants={participants}
                    currentUserId={userId}
                    currentUserName={userName}
                    currentUserColor={userColor}
                    allDayLabels={allDayLabels}
                    onUpdated={load}
                  />
                ))}
              </div>
            </section>
          ))}

          {noDayBlocks.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm font-medium text-[var(--ink-3)]">Unscheduled</span>
                <div className="h-px flex-1 bg-[var(--paper-3)]" />
                {userId && (
                  <button
                    onClick={() =>
                      setBulkEditTarget({
                        date: null,
                        label: "Unscheduled",
                        blocks: noDayBlocks,
                      })
                    }
                    className="text-xs text-[var(--ink-3)] hover:text-[var(--accent)] hover:underline transition whitespace-nowrap"
                  >
                    Edit
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {noDayBlocks.map((b) => (
                  <ItineraryBlockComponent
                    key={b.id}
                    block={b}
                    participants={participants}
                    currentUserId={userId}
                    currentUserName={userName}
                    currentUserColor={userColor}
                    allDayLabels={allDayLabels}
                    onUpdated={load}
                  />
                ))}
              </div>
            </section>
          )}

          {noBlocks && !showAdd && (
            <EmptyTripCard onAdd={() => setShowAdd(true)} />
          )}

          {noFilteredBlocks && (
            <div className="text-center py-10 text-[var(--ink-3)] text-sm">
              No blocks match this filter.
              <button onClick={() => setStatusFilter("all")} className="ml-1 text-[var(--accent)] hover:underline">
                Show all
              </button>
            </div>
          )}
        </div>
      )}

      {tab === "table" && (
        <>
          {noBlocks ? (
            <EmptyTripCard onAdd={() => setShowAdd(true)} />
          ) : (
            <TripTableView blocks={filteredBlocks} />
          )}
        </>
      )}

      {tab === "today" && <TodayView trip={trip} blocks={blocks} />}

      {tab === "packing" && (
        <PackingList
          tripId={id}
          participants={participants}
          currentUserId={userId}
          currentUserName={userName}
        />
      )}

      {tab === "readiness" && (
        <ReadinessDashboard
          trip={trip}
          blocks={blocks}
          participants={participants}
          bookings={bookings}
          currentUserId={userId}
          currentUserName={userName}
        />
      )}

      {showAssistant && userId && (
        <PlanAssistant
          tripId={id}
          blocks={blocks}
          currentUserId={userId}
          currentUserName={userName}
          onClose={() => setShowAssistant(false)}
          onAdded={load}
        />
      )}

      {bulkEditTarget && userId && (
        <BlockBulkEditor
          tripId={id}
          dayDate={bulkEditTarget.date}
          dayLabel={bulkEditTarget.label}
          blocks={bulkEditTarget.blocks}
          onCancel={() => setBulkEditTarget(null)}
          onSave={applyDayBulkEdit}
        />
      )}
    </main>
  );
}

function EmptyTripCard({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="bg-white border border-dashed border-[var(--paper-3)] rounded-xl p-8 text-center">
      <h3 className="font-serif text-lg font-semibold text-[var(--ink)]">Your trip is empty.</h3>
      <p className="text-sm text-[var(--ink-3)] mt-1">Start by adding what you know — bookings, ideas, or a hike day.</p>
      <div className="grid sm:grid-cols-3 gap-2 mt-5 max-w-md mx-auto">
        <button
          onClick={onAdd}
          className="text-left p-3 rounded-lg bg-[var(--paper-2)] hover:bg-[var(--paper-3)] transition"
        >
          <div className="text-sm font-medium text-[var(--ink)]">Paste a booking</div>
          <div className="text-xs text-[var(--ink-3)] mt-0.5">Flight, stay, etc.</div>
        </button>
        <button
          onClick={onAdd}
          className="text-left p-3 rounded-lg bg-[var(--paper-2)] hover:bg-[var(--paper-3)] transition"
        >
          <div className="text-sm font-medium text-[var(--ink)]">Add a hike</div>
          <div className="text-xs text-[var(--ink-3)] mt-0.5">With waypoints</div>
        </button>
        <button
          onClick={onAdd}
          className="text-left p-3 rounded-lg bg-[var(--paper-2)] hover:bg-[var(--paper-3)] transition"
        >
          <div className="text-sm font-medium text-[var(--ink)]">Drop an idea</div>
          <div className="text-xs text-[var(--ink-3)] mt-0.5">Anywhere, any time</div>
        </button>
      </div>
    </div>
  );
}
