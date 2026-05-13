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
import PackingList from "@/components/trip/PackingList";
import ExportModal from "@/components/trip/ExportModal";
import PlanAssistant from "@/components/itinerary/PlanAssistant";
import BlockBulkEditor from "@/components/itinerary/BlockBulkEditor";
import { logActivity } from "@/lib/activity";
import { shortDayLabel, type BlockDiff } from "@/lib/block-text";
import {
  DndContext,
  closestCenter,
  MeasuringStrategy,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Sparkles, GripVertical } from "lucide-react";

type Tab = "plan" | "table" | "packing" | "readiness";
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
  const [showExport, setShowExport] = useState(false);
  const [bulkEditTarget, setBulkEditTarget] = useState<{
    date: string | null;
    label: string;
    blocks: ItineraryBlock[];
  } | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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
        sort_order: t.sort_order,
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

    // Reorders (sort_order only)
    for (const r of result.toReorder) {
      await supabase
        .from("itinerary_blocks")
        .update({ sort_order: r.sort_order })
        .eq("id", r.id);
    }

    const total =
      result.toInsert.length +
      result.toDelete.length +
      result.toUpdate.length +
      result.toReorder.length;
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

  // Move (and reorder) a block. Handles within-day reorder AND cross-day moves
  // including to/from Unscheduled. The target day is renumbered contiguously
  // 0..N so display order matches caller intent.
  async function moveBlock(
    blockId: string,
    targetDate: string | null,
    overItemId: string | null
  ) {
    if (!userId) return;
    const supabase = createClient();
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;
    const sourceDate = block.date ?? null;
    const sourceChanged = sourceDate !== targetDate;

    // Build the FULL ordered target group (including the dragged item if it
    // already lives in this group). arrayMove needs the dragged item present
    // to compute the right destination index without the off-by-one that
    // affects "filter-and-splice" approaches when dragging downward.
    const fullTargetGroup = blocks
      .filter((b) => (b.date ?? null) === targetDate)
      .sort(
        (a, b) =>
          a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)
      );
    const includesActive = fullTargetGroup.some((b) => b.id === blockId);

    let newOrder: ItineraryBlock[];
    if (includesActive) {
      // SAME-GROUP REORDER — use arrayMove on the full list.
      const oldIndex = fullTargetGroup.findIndex((b) => b.id === blockId);
      const newIndex = overItemId
        ? fullTargetGroup.findIndex((b) => b.id === overItemId)
        : fullTargetGroup.length - 1;
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
      newOrder = arrayMove(fullTargetGroup, oldIndex, newIndex);
    } else {
      // CROSS-GROUP MOVE — splice in. No off-by-one because the dragged item
      // isn't in the target group's findIndex calculation.
      const insertIdx = overItemId
        ? Math.max(0, fullTargetGroup.findIndex((b) => b.id === overItemId))
        : fullTargetGroup.length;
      newOrder = [...fullTargetGroup];
      newOrder.splice(insertIdx, 0, block);
    }

    const idToNewOrder = new Map(newOrder.map((b, idx) => [b.id, idx]));
    const sourceNewSort = idToNewOrder.get(blockId)!;

    if (!sourceChanged && block.sort_order === sourceNewSort) return;

    const newDayLabel = targetDate ? shortDayLabel(targetDate) : null;

    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id === blockId) {
          return {
            ...b,
            date: targetDate,
            day_label: sourceChanged ? newDayLabel : b.day_label,
            sort_order: sourceNewSort,
          };
        }
        if (idToNewOrder.has(b.id)) {
          return { ...b, sort_order: idToNewOrder.get(b.id)! };
        }
        return b;
      })
    );

    const sourcePatch: Record<string, unknown> = { sort_order: sourceNewSort };
    if (sourceChanged) {
      sourcePatch.date = targetDate;
      sourcePatch.day_label = newDayLabel;
    }
    await supabase.from("itinerary_blocks").update(sourcePatch).eq("id", blockId);

    await Promise.all(
      Array.from(idToNewOrder.entries())
        .filter(([id]) => id !== blockId)
        .map(([id, sort_order]) =>
          supabase.from("itinerary_blocks").update({ sort_order }).eq("id", id)
        )
    );

    if (sourceChanged) {
      await logActivity(supabase, {
        tripId: id,
        userId,
        actorName: userName,
        action: "block.moved",
        targetId: blockId,
        summary: `moved ${block.title} to ${targetDate ? newDayLabel : "Unscheduled"}`,
      });
    }
  }

  function handleBlockDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    let targetDate: string | null;
    let overItemId: string | null = null;
    if (overId.startsWith("day::")) {
      const raw = overId.slice("day::".length);
      targetDate = raw === "unscheduled" ? null : raw;
    } else {
      const overBlock = blocks.find((b) => b.id === overId);
      if (!overBlock) return;
      targetDate = overBlock.date ?? null;
      overItemId = overId;
    }
    moveBlock(activeId, targetDate, overItemId);
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
  // Sort each day's blocks by sort_order (then created_at). The blocks state
  // array isn't reordered after an optimistic move — only sort_order values
  // change — so we have to apply the ordering at render time.
  const sortBlocks = (a: ItineraryBlock, b: ItineraryBlock) =>
    a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at);
  for (const group of dayGroups.values()) {
    group.blocks.sort(sortBlocks);
  }
  noDayBlocks.sort(sortBlocks);

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
        onExport={() => setShowExport(true)}
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
          {(["plan", "table", "packing", "readiness"] as Tab[]).map((t) => (
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
          onDragEnd={handleBlockDragEnd}
        >
          <div className="space-y-8">
            {days.map((group, dayIdx) => (
              <DayDroppable
                key={group.key}
                dayKey={group.date ?? group.key}
                dayIndex={dayIdx + 1}
                label={group.label}
                blockIds={group.blocks.map((b) => b.id)}
                showEdit={!!userId}
                onEdit={() =>
                  setBulkEditTarget({
                    date: group.date,
                    label: group.label,
                    blocks: group.blocks,
                  })
                }
              >
                {group.blocks.map((b) => (
                  <SortableBlockRow key={b.id} blockId={b.id}>
                    <ItineraryBlockComponent
                      block={b}
                      participants={participants}
                      currentUserId={userId}
                      currentUserName={userName}
                      currentUserColor={userColor}
                      allDayLabels={allDayLabels}
                      onUpdated={load}
                    />
                  </SortableBlockRow>
                ))}
              </DayDroppable>
            ))}

            {(noDayBlocks.length > 0 || blocks.length > 0) && (
              <DayDroppable
                dayKey="unscheduled"
                label="Unscheduled"
                blockIds={noDayBlocks.map((b) => b.id)}
                showEdit={!!userId && noDayBlocks.length > 0}
                onEdit={() =>
                  setBulkEditTarget({
                    date: null,
                    label: "Unscheduled",
                    blocks: noDayBlocks,
                  })
                }
                isUnscheduled
              >
                {noDayBlocks.map((b) => (
                  <SortableBlockRow key={b.id} blockId={b.id}>
                    <ItineraryBlockComponent
                      block={b}
                      participants={participants}
                      currentUserId={userId}
                      currentUserName={userName}
                      currentUserColor={userColor}
                      allDayLabels={allDayLabels}
                      onUpdated={load}
                    />
                  </SortableBlockRow>
                ))}
              </DayDroppable>
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
        </DndContext>
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

      {showExport && (
        <ExportModal
          trip={trip}
          blocks={blocks}
          participants={participants}
          onClose={() => setShowExport(false)}
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

interface DayDroppableProps {
  dayKey: string;
  dayIndex?: number;
  label: string;
  blockIds: string[];
  showEdit: boolean;
  onEdit: () => void;
  isUnscheduled?: boolean;
  children: React.ReactNode;
}

function DayDroppable({
  dayKey,
  dayIndex,
  label,
  blockIds,
  showEdit,
  onEdit,
  isUnscheduled,
  children,
}: DayDroppableProps) {
  const droppableId = `day::${isUnscheduled ? "unscheduled" : dayKey}`;
  const { setNodeRef, isOver } = useDroppable({ id: droppableId });

  return (
    <section>
      <div className="flex items-baseline gap-3 mb-3">
        {isUnscheduled ? (
          <span className="text-sm font-medium text-[var(--ink-3)]">Unscheduled</span>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="font-serif text-2xl font-bold text-[var(--ink)] leading-none">
                {dayIndex}
              </span>
              <p className="text-xs font-semibold text-[var(--ink-3)] uppercase tracking-wider leading-none">
                Day
              </p>
            </div>
            <div className="h-px flex-1 bg-[var(--paper-3)]" />
            <span className="text-sm text-[var(--ink-3)] font-medium whitespace-nowrap">
              {label}
            </span>
          </>
        )}
        {isUnscheduled && <div className="h-px flex-1 bg-[var(--paper-3)]" />}
        {showEdit && (
          <button
            onClick={onEdit}
            className="text-xs text-[var(--ink-3)] hover:text-[var(--accent)] hover:underline transition whitespace-nowrap"
          >
            Edit
          </button>
        )}
      </div>

      <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`space-y-2 min-h-[16px] rounded-lg ${
            isOver && blockIds.length === 0
              ? "bg-[var(--paper-2)] outline outline-1 outline-dashed outline-[var(--paper-3)] p-2"
              : ""
          }`}
        >
          {blockIds.length === 0 && isUnscheduled && (
            <p className="text-xs text-[var(--ink-3)] italic px-2 py-1">
              Drag here to unschedule a block.
            </p>
          )}
          {children}
        </div>
      </SortableContext>
    </section>
  );
}

function SortableBlockRow({
  blockId,
  children,
}: {
  blockId: string;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: blockId });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="relative group">
      <span
        {...listeners}
        className="absolute left-2 top-2 cursor-grab active:cursor-grabbing text-[var(--ink-3)] opacity-0 group-hover:opacity-100 transition select-none touch-none z-10"
        title="Drag to reorder or move to another day"
        aria-label="Drag handle"
      >
        <GripVertical size={14} />
      </span>
      {children}
    </div>
  );
}
