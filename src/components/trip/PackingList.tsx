"use client";

import { useEffect, useState } from "react";
import type { PackingItem, PackingScope, Participant } from "@/lib/types";
import Avatar from "@/components/ui/Avatar";
import { createClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity";
import PackingImporter, { ImportedItem } from "./PackingImporter";
import PackingHistoryDrawer from "./PackingHistoryDrawer";
import PackingItemHistory from "./PackingItemHistory";
import PackingBulkEditor from "./PackingBulkEditor";
import {
  DndContext,
  closestCorners,
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
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Sparkles, Plus, Trash2, Check, History, Upload, Info, Pencil, GripVertical,
} from "lucide-react";

const CATEGORIES = ["Gear", "Clothing", "Food", "Documents", "Other"];
const SCOPES: PackingScope[] = ["shared", "personal"];
const SCOPE_LABEL: Record<PackingScope, string> = {
  shared: "Shared",
  personal: "Personal",
};
const SCOPE_HINT: Record<PackingScope, string> = {
  shared: "One per group — claim who brings each",
  personal: "Everyone brings their own",
};

interface PackingListProps {
  tripId: string;
  participants: Participant[];
  currentUserId: string | null;
  currentUserName: string | null;
}

interface RowCtx {
  participants: Participant[];
  currentUserId: string | null;
  myParticipant: Participant | undefined;
  scope: PackingScope;
  openAssignFor: string | null;
  setOpenAssignFor: (id: string | null) => void;
  openCategoryFor: string | null;
  setOpenCategoryFor: (id: string | null) => void;
  openHistoryFor: string | null;
  setOpenHistoryFor: (id: string | null) => void;
  editingLabelId: string | null;
  setEditingLabelId: (id: string | null) => void;
  labelDraft: string;
  setLabelDraft: (s: string) => void;
  togglePacked: (item: PackingItem) => void;
  renameItem: (item: PackingItem, newLabel: string) => void;
  recategorize: (item: PackingItem, newCategory: string) => void;
  assign: (item: PackingItem, participantId: string | null) => void;
  deleteItem: (item: PackingItem) => void;
}

export default function PackingList({
  tripId,
  participants,
  currentUserId,
  currentUserName,
}: PackingListProps) {
  const [items, setItems] = useState<PackingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggesting, setSuggesting] = useState(false);
  const [addLabel, setAddLabel] = useState<Record<string, string>>({});
  const [openAssignFor, setOpenAssignFor] = useState<string | null>(null);
  const [openCategoryFor, setOpenCategoryFor] = useState<string | null>(null);
  const [openHistoryFor, setOpenHistoryFor] = useState<string | null>(null);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState("");
  const [showImporter, setShowImporter] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showBulkEditor, setShowBulkEditor] = useState(false);
  const supabase = createClient();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function fetchItems() {
    const { data } = await supabase
      .from("packing_items")
      .select("*")
      .eq("trip_id", tripId)
      .is("deleted_at", null)
      .order("sort_order")
      .order("created_at");
    setItems((data ?? []) as PackingItem[]);
    setLoading(false);
  }

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  const myParticipant = participants.find((p) => p.user_id === currentUserId);

  function normalCat(c: string): string {
    return CATEGORIES.includes(c) ? c : "Other";
  }

  function normalScope(s: PackingScope | null | undefined): PackingScope {
    return s === "personal" ? "personal" : "shared";
  }

  // Move (and reorder) a packing item. Handles within-group reorder AND
  // cross-group moves (cross-category or cross-scope). The target group is
  // renumbered contiguously 0..N so display order matches caller intent.
  async function movePackingItem(
    itemId: string,
    targetScope: PackingScope,
    targetCategory: string,
    overItemId: string | null
  ) {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const currentScope = normalScope(item.scope);
    const currentCat = normalCat(item.category);
    const sourceChanged = currentScope !== targetScope || currentCat !== targetCategory;

    const targetGroup = items
      .filter(
        (i) =>
          i.id !== itemId &&
          normalScope(i.scope) === targetScope &&
          normalCat(i.category) === targetCategory
      )
      .sort(
        (a, b) =>
          (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
          a.created_at.localeCompare(b.created_at)
      );

    const insertIdx = overItemId
      ? Math.max(0, targetGroup.findIndex((i) => i.id === overItemId))
      : targetGroup.length;

    const newOrder = [...targetGroup];
    newOrder.splice(insertIdx, 0, item);

    const idToNewOrder = new Map(newOrder.map((it, idx) => [it.id, idx]));
    const sourceNewSort = idToNewOrder.get(itemId)!;

    // Bail if nothing actually changed (same group, same position)
    if (!sourceChanged && item.sort_order === sourceNewSort) return;

    const clearAssignee = sourceChanged && targetScope === "personal" && !!item.assigned_to;

    // Optimistic UI
    setItems((prev) =>
      prev.map((i) => {
        if (i.id === itemId) {
          return {
            ...i,
            scope: targetScope,
            category: targetCategory,
            sort_order: sourceNewSort,
            assigned_to: clearAssignee ? null : i.assigned_to,
          };
        }
        if (idToNewOrder.has(i.id)) {
          return { ...i, sort_order: idToNewOrder.get(i.id)! };
        }
        return i;
      })
    );

    // Source item update bundle
    const sourcePatch: Record<string, unknown> = { sort_order: sourceNewSort };
    if (sourceChanged) {
      sourcePatch.scope = targetScope;
      sourcePatch.category = targetCategory;
      if (clearAssignee) sourcePatch.assigned_to = null;
    }
    await supabase.from("packing_items").update(sourcePatch).eq("id", itemId);

    // Peer updates in target group
    await Promise.all(
      Array.from(idToNewOrder.entries())
        .filter(([id]) => id !== itemId)
        .map(([id, sort_order]) =>
          supabase.from("packing_items").update({ sort_order }).eq("id", id)
        )
    );

    if (sourceChanged) {
      await log(
        "packing.moved",
        `moved ${item.label} to ${targetScope} · ${targetCategory}`,
        itemId
      );
    }
  }

  async function log(action: string, summary: string, targetId?: string) {
    if (!currentUserId) return;
    await logActivity(supabase, {
      tripId,
      userId: currentUserId,
      actorName: currentUserName,
      action,
      targetId,
      summary,
    });
  }

  async function addItem(scope: PackingScope, category: string) {
    const key = `${scope}|${category}`;
    const label = (addLabel[key] ?? "").trim();
    if (!label) return;
    // Append at end of its (scope, category) group
    const groupSize = items.filter(
      (i) => normalScope(i.scope) === scope && normalCat(i.category) === category
    ).length;
    const { data } = await supabase
      .from("packing_items")
      .insert({
        trip_id: tripId,
        label,
        category,
        scope,
        sort_order: groupSize,
        created_by: currentUserId,
      } as Record<string, unknown>)
      .select()
      .single();
    if (data) {
      const inserted = data as PackingItem;
      setItems((prev) => [...prev, inserted]);
      setAddLabel((prev) => ({ ...prev, [key]: "" }));
      await log("packing.added", `added ${inserted.label}`, inserted.id);
    }
  }

  async function togglePacked(item: PackingItem) {
    const next = !item.packed;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, packed: next } : i)));
    await supabase.from("packing_items").update({ packed: next }).eq("id", item.id);
  }

  async function assign(item: PackingItem, participantId: string | null) {
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, assigned_to: participantId } : i))
    );
    setOpenAssignFor(null);
    await supabase.from("packing_items").update({ assigned_to: participantId }).eq("id", item.id);
    if (participantId === null) {
      await log("packing.assigned", `unassigned ${item.label}`, item.id);
    } else {
      const p = participants.find((x) => x.id === participantId);
      await log("packing.assigned", `assigned ${item.label} to ${p?.name ?? "someone"}`, item.id);
    }
  }

  async function deleteItem(item: PackingItem) {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    await supabase
      .from("packing_items")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", item.id);
    await log("packing.removed", `removed ${item.label}`, item.id);
  }

  async function renameItem(item: PackingItem, newLabel: string) {
    const trimmed = newLabel.trim();
    setEditingLabelId(null);
    if (!trimmed || trimmed === item.label) return;
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, label: trimmed } : i))
    );
    await supabase.from("packing_items").update({ label: trimmed }).eq("id", item.id);
    await log("packing.renamed", `renamed ${item.label} → ${trimmed}`, item.id);
  }

  async function recategorize(item: PackingItem, newCategory: string) {
    setOpenCategoryFor(null);
    if (newCategory === item.category) return;
    // Route through movePackingItem so sort_order stays clean.
    await movePackingItem(item.id, normalScope(item.scope), normalCat(newCategory), null);
  }

  async function suggestAI() {
    setSuggesting(true);
    try {
      const res = await fetch("/api/suggest-packing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId }),
      });
      const data = await res.json();
      if (data.items?.length) {
        // Group AI output by (scope, category) so sort_orders stay clean per group
        const byGroup = new Map<string, number>();
        const rows = data.items.map(
          (it: { label: string; category: string; scope?: PackingScope }) => {
            const scope: PackingScope = it.scope === "personal" ? "personal" : "shared";
            const category = CATEGORIES.includes(it.category) ? it.category : "Other";
            const k = `${scope}|${category}`;
            const idx = byGroup.get(k) ?? 0;
            byGroup.set(k, idx + 1);
            return {
              trip_id: tripId,
              label: it.label,
              category,
              scope,
              sort_order: idx,
              created_by: currentUserId,
            };
          }
        );
        const { data: inserted } = await supabase
          .from("packing_items")
          .insert(rows as Record<string, unknown>[])
          .select();
        if (inserted) {
          setItems((prev) => [...prev, ...(inserted as PackingItem[])]);
          await log(
            "packing.bulk_imported",
            `seeded ${(inserted as PackingItem[]).length} items with AI`
          );
        }
      }
    } finally {
      setSuggesting(false);
    }
  }

  async function handleImport(imported: ImportedItem[], mode: "append" | "replace") {
    if (mode === "replace") {
      const existingIds = items.map((i) => i.id);
      if (existingIds.length) {
        await supabase
          .from("packing_items")
          .update({ deleted_at: new Date().toISOString() })
          .in("id", existingIds);
        for (const item of items) {
          await log("packing.removed", `removed ${item.label}`, item.id);
        }
      }
      setItems([]);
    }
    const byGroup = new Map<string, number>();
    const rows = imported.map((it) => {
      const scope: PackingScope = (it as { scope?: PackingScope }).scope === "personal" ? "personal" : "shared";
      const category = CATEGORIES.includes(it.category) ? it.category : "Other";
      const k = `${scope}|${category}`;
      const idx = byGroup.get(k) ?? 0;
      byGroup.set(k, idx + 1);
      return {
        trip_id: tripId,
        label: it.label,
        category,
        scope,
        sort_order: idx,
        created_by: currentUserId,
      };
    });
    const { data: inserted } = await supabase
      .from("packing_items")
      .insert(rows as Record<string, unknown>[])
      .select();
    if (inserted) {
      setItems((prev) => [...prev, ...(inserted as PackingItem[])]);
      await log(
        "packing.bulk_imported",
        `imported ${(inserted as PackingItem[]).length} items`
      );
    }
    setShowImporter(false);
  }

  async function handleBulkSave(result: {
    toInsert: Array<{ scope: PackingScope; category: string; label: string; assigneeName?: string | null; sort_order: number }>;
    toSoftDelete: PackingItem[];
    toUpdate: Array<{ id: string; assigned_to: string | null; oldLabel: string; newAssigneeName: string | null }>;
    toReorder: Array<{ id: string; sort_order: number }>;
  }) {
    // Inserts
    if (result.toInsert.length > 0) {
      const rows = result.toInsert.map((t) => {
        const assigneeId = t.assigneeName
          ? participants.find(
              (p) => (p.name ?? "").toLowerCase() === t.assigneeName!.toLowerCase()
            )?.id ?? null
          : null;
        return {
          trip_id: tripId,
          label: t.label,
          category: CATEGORIES.includes(t.category) ? t.category : "Other",
          scope: t.scope,
          assigned_to: assigneeId,
          sort_order: t.sort_order,
          created_by: currentUserId,
        };
      });
      const { data: inserted } = await supabase
        .from("packing_items")
        .insert(rows as Record<string, unknown>[])
        .select();
      if (inserted) {
        for (const ins of inserted as PackingItem[]) {
          await log("packing.added", `added ${ins.label}`, ins.id);
        }
      }
    }

    // Soft deletes
    if (result.toSoftDelete.length > 0) {
      const ids = result.toSoftDelete.map((i) => i.id);
      await supabase
        .from("packing_items")
        .update({ deleted_at: new Date().toISOString() })
        .in("id", ids);
      for (const i of result.toSoftDelete) {
        await log("packing.removed", `removed ${i.label}`, i.id);
      }
    }

    // Updates (assignee changes)
    for (const u of result.toUpdate) {
      await supabase.from("packing_items").update({ assigned_to: u.assigned_to }).eq("id", u.id);
      const name = u.newAssigneeName ?? "no one";
      await log(
        "packing.assigned",
        `assigned ${u.oldLabel} to ${name}`,
        u.id
      );
    }

    // Reorder (sort_order changes)
    for (const r of result.toReorder) {
      await supabase.from("packing_items").update({ sort_order: r.sort_order }).eq("id", r.id);
    }

    const total =
      result.toInsert.length +
      result.toSoftDelete.length +
      result.toUpdate.length +
      result.toReorder.length;
    if (total > 0) {
      await log(
        "packing.bulk_imported",
        `edited list (${result.toInsert.length} added, ${result.toSoftDelete.length} removed, ${result.toUpdate.length} reassigned, ${result.toReorder.length} reordered)`
      );
    }

    setShowBulkEditor(false);
    await fetchItems();
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    let targetScope: PackingScope;
    let targetCategory: string;
    let overItemId: string | null = null;

    if (overId.startsWith("container::")) {
      const [, s, c] = overId.split("::");
      targetScope = s as PackingScope;
      targetCategory = c;
    } else {
      const overItem = items.find((i) => i.id === overId);
      if (!overItem) return;
      targetScope = normalScope(overItem.scope);
      targetCategory = normalCat(overItem.category);
      overItemId = overId;
    }

    movePackingItem(activeId, targetScope, targetCategory, overItemId);
  }

  if (loading) {
    return <p className="text-sm text-[var(--ink-3)] py-6 text-center">Loading…</p>;
  }

  // Group: scope → category → items
  const grouped: Record<PackingScope, Record<string, PackingItem[]>> = {
    shared: Object.fromEntries(CATEGORIES.map((c) => [c, []])) as Record<string, PackingItem[]>,
    personal: Object.fromEntries(CATEGORIES.map((c) => [c, []])) as Record<string, PackingItem[]>,
  };
  for (const it of items) {
    grouped[normalScope(it.scope)][normalCat(it.category)].push(it);
  }
  // Within each cell, sort by sort_order then created_at
  for (const s of SCOPES) {
    for (const c of CATEGORIES) {
      grouped[s][c].sort(
        (a, b) =>
          (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
          a.created_at.localeCompare(b.created_at)
      );
    }
  }

  const totalPacked = items.filter((i) => i.packed).length;

  const ctxBase = {
    participants,
    currentUserId,
    myParticipant,
    openAssignFor,
    setOpenAssignFor,
    openCategoryFor,
    setOpenCategoryFor,
    openHistoryFor,
    setOpenHistoryFor,
    editingLabelId,
    setEditingLabelId,
    labelDraft,
    setLabelDraft,
    togglePacked,
    renameItem,
    recategorize,
    assign,
    deleteItem,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-[var(--ink-3)]">
          {totalPacked} / {items.length} packed
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {currentUserId && (
            <>
              {items.length > 0 && (
                <button
                  onClick={() => setShowBulkEditor(true)}
                  className="flex items-center gap-1.5 text-sm bg-[var(--ink)] text-white px-3 py-1.5 rounded-lg hover:opacity-90 transition"
                >
                  <Pencil size={13} />
                  Edit list
                </button>
              )}
              <button
                onClick={() => setShowImporter(true)}
                className="flex items-center gap-1.5 text-sm border border-[var(--paper-3)] text-[var(--ink-2)] px-3 py-1.5 rounded-lg hover:bg-[var(--paper-2)] transition"
              >
                <Upload size={13} />
                Import
              </button>
              <button
                onClick={() => setShowHistory(true)}
                className="flex items-center gap-1.5 text-sm border border-[var(--paper-3)] text-[var(--ink-2)] px-3 py-1.5 rounded-lg hover:bg-[var(--paper-2)] transition"
              >
                <History size={13} />
                History
              </button>
              {items.length === 0 && (
                <button
                  onClick={suggestAI}
                  disabled={suggesting}
                  className="flex items-center gap-1.5 text-sm bg-[var(--accent)] text-white px-3 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  <Sparkles size={14} />
                  {suggesting ? "Building list…" : "Generate with AI"}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {items.length === 0 && !suggesting && (
        <div className="bg-white border border-dashed border-[var(--paper-3)] rounded-xl p-8 text-center">
          <p className="font-medium text-[var(--ink)]">Empty packing list</p>
          <p className="text-sm text-[var(--ink-3)] mt-1">
            Start with AI suggestions, import a list, or add items by scope + category below.
          </p>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragEnd={handleDragEnd}
      >
        {SCOPES.map((scope) => {
          const scopeItems = items.filter((i) => normalScope(i.scope) === scope);
          if (items.length === 0) return null;
          const scopePacked = scopeItems.filter((i) => i.packed).length;

          return (
            <div key={scope} className="border border-[var(--paper-3)] rounded-2xl bg-[var(--paper)] overflow-hidden">
              <div className="px-4 py-2.5 bg-[var(--paper-2)] border-b border-[var(--paper-3)]">
                <div className="flex items-baseline justify-between">
                  <h2 className="font-serif text-base font-semibold text-[var(--ink)]">
                    {SCOPE_LABEL[scope]}
                    <span className="text-xs font-normal text-[var(--ink-3)] ml-2">
                      {scopePacked}/{scopeItems.length} packed
                    </span>
                  </h2>
                  <p className="text-xs text-[var(--ink-3)] italic">{SCOPE_HINT[scope]}</p>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {CATEGORIES.map((cat) => (
                  <CategoryDroppable
                    key={cat}
                    scope={scope}
                    cat={cat}
                    items={grouped[scope][cat]}
                    ctx={{ ...ctxBase, scope }}
                    addValue={addLabel[`${scope}|${cat}`] ?? ""}
                    setAddValue={(v) =>
                      setAddLabel((prev) => ({ ...prev, [`${scope}|${cat}`]: v }))
                    }
                    onAdd={() => addItem(scope, cat)}
                    canAdd={!!currentUserId}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </DndContext>

      {showImporter && (
        <PackingImporter
          existingCount={items.length}
          onImport={handleImport}
          onCancel={() => setShowImporter(false)}
        />
      )}

      {showHistory && (
        <PackingHistoryDrawer
          tripId={tripId}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          participants={participants}
          onClose={() => setShowHistory(false)}
          onRestored={fetchItems}
        />
      )}

      {showBulkEditor && (
        <PackingBulkEditor
          tripId={tripId}
          items={items}
          participants={participants}
          onCancel={() => setShowBulkEditor(false)}
          onSave={handleBulkSave}
        />
      )}
    </div>
  );
}

interface CategoryDroppableProps {
  scope: PackingScope;
  cat: string;
  items: PackingItem[];
  ctx: RowCtx;
  addValue: string;
  setAddValue: (v: string) => void;
  onAdd: () => void;
  canAdd: boolean;
}

function CategoryDroppable({ scope, cat, items, ctx, addValue, setAddValue, onAdd, canAdd }: CategoryDroppableProps) {
  const droppableId = `container::${scope}::${cat}`;
  const { setNodeRef, isOver } = useDroppable({ id: droppableId });

  return (
    <section ref={setNodeRef}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)] mb-2">
        {cat}
        {items.length > 0 && (
          <span className="opacity-60"> · {items.length}</span>
        )}
      </h3>
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul
          className={`space-y-1.5 mb-2 min-h-[16px] rounded ${
            isOver && items.length === 0 ? "bg-[var(--paper-2)] outline outline-1 outline-dashed outline-[var(--paper-3)]" : ""
          }`}
        >
          {items.map((item) => (
            <SortablePackingRow key={item.id} item={item} ctx={ctx} />
          ))}
        </ul>
      </SortableContext>
      {canAdd && (
        <div className="flex items-center gap-2">
          <input
            value={addValue}
            onChange={(e) => setAddValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAdd()}
            placeholder={`Add to ${cat.toLowerCase()}…`}
            className="flex-1 text-sm bg-white border border-[var(--paper-3)] rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
          <button
            onClick={onAdd}
            disabled={!addValue.trim()}
            className="text-sm text-[var(--accent)] disabled:opacity-30 p-1.5"
          >
            <Plus size={16} />
          </button>
        </div>
      )}
    </section>
  );
}

interface SortablePackingRowProps {
  item: PackingItem;
  ctx: RowCtx;
}

function SortablePackingRow({ item, ctx }: SortablePackingRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  const assignee = item.assigned_to
    ? ctx.participants.find((p) => p.id === item.assigned_to)
    : null;
  const isEditing = ctx.editingLabelId === item.id;

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`flex items-center gap-2 bg-white border border-[var(--paper-3)] rounded-lg px-3 py-2 group relative transition ${
        item.packed ? "opacity-60" : ""
      }`}
    >
      <span
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-[var(--ink-3)] opacity-0 group-hover:opacity-100 transition flex-shrink-0 select-none touch-none"
        title="Drag to reorder or move"
        aria-label="Drag handle"
      >
        <GripVertical size={12} />
      </span>

      <button
        onClick={() => ctx.togglePacked(item)}
        className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
          item.packed
            ? "bg-[var(--green)] border-[var(--green)] text-white"
            : "border-[var(--paper-3)] hover:border-[var(--ink-3)]"
        }`}
      >
        {item.packed && <Check size={12} />}
      </button>

      {isEditing ? (
        <input
          autoFocus
          value={ctx.labelDraft}
          onChange={(e) => ctx.setLabelDraft(e.target.value)}
          onBlur={() => ctx.renameItem(item, ctx.labelDraft)}
          onKeyDown={(e) => {
            if (e.key === "Enter") ctx.renameItem(item, ctx.labelDraft);
            else if (e.key === "Escape") ctx.setEditingLabelId(null);
          }}
          className="flex-1 text-sm bg-[var(--paper-2)] border border-[var(--paper-3)] rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
      ) : (
        <button
          onClick={() => {
            ctx.setEditingLabelId(item.id);
            ctx.setLabelDraft(item.label);
          }}
          className={`flex-1 text-left text-sm hover:text-[var(--accent)] transition ${
            item.packed ? "line-through" : ""
          }`}
          title="Click to rename"
        >
          {item.label}
        </button>
      )}

      {/* Category pill */}
      <div className="relative">
        <button
          onClick={() =>
            ctx.setOpenCategoryFor(ctx.openCategoryFor === item.id ? null : item.id)
          }
          className="text-[10px] uppercase tracking-wide text-[var(--ink-3)] hover:text-[var(--ink)] bg-[var(--paper-2)] hover:bg-[var(--paper-3)] px-2 py-0.5 rounded-full"
          title="Click to change category"
        >
          {item.category}
        </button>
        {ctx.openCategoryFor === item.id && (
          <div className="absolute right-0 top-full mt-1 bg-white border border-[var(--paper-3)] rounded-lg shadow-md py-1 z-20">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => ctx.recategorize(item, c)}
                className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--paper-2)] ${
                  c === item.category ? "text-[var(--ink-3)]" : ""
                }`}
              >
                {c} {c === item.category && "·  ✓"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Assignee — shared only */}
      {ctx.scope === "shared" && (
        <div className="relative">
          <button
            onClick={() =>
              ctx.setOpenAssignFor(ctx.openAssignFor === item.id ? null : item.id)
            }
            className="flex items-center"
            title={assignee ? `Assigned to ${assignee.name}` : "Click to assign"}
          >
            {assignee ? (
              <Avatar name={assignee.name} color={assignee.color} size="sm" />
            ) : (
              <span className="text-xs text-[var(--ink-3)] hover:text-[var(--ink)] px-2 py-1 rounded-full bg-[var(--paper-2)]">
                Claim
              </span>
            )}
          </button>
          {ctx.openAssignFor === item.id && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-[var(--paper-3)] rounded-lg shadow-md py-1 z-20 min-w-[140px]">
              <button
                onClick={() => ctx.myParticipant && ctx.assign(item, ctx.myParticipant.id)}
                disabled={!ctx.myParticipant}
                className="block w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--paper-2)] disabled:opacity-50"
              >
                I&apos;ll bring it
              </button>
              {ctx.participants
                .filter((p) => p.user_id !== ctx.currentUserId)
                .map((p) => (
                  <button
                    key={p.id}
                    onClick={() => ctx.assign(item, p.id)}
                    className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--paper-2)]"
                  >
                    <Avatar name={p.name} color={p.color} size="sm" />
                    {p.name}
                  </button>
                ))}
              {item.assigned_to && (
                <button
                  onClick={() => ctx.assign(item, null)}
                  className="block w-full text-left px-3 py-1.5 text-sm text-[var(--ink-3)] hover:bg-[var(--paper-2)] border-t border-[var(--paper-3)] mt-1"
                >
                  Unassign
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Personal scope marker */}
      {ctx.scope === "personal" && (
        <span className="text-[10px] text-[var(--ink-3)] italic">everyone</span>
      )}

      {/* History info */}
      <div className="relative">
        <button
          onClick={() =>
            ctx.setOpenHistoryFor(ctx.openHistoryFor === item.id ? null : item.id)
          }
          className="text-[var(--ink-3)] hover:text-[var(--ink)] p-1 opacity-0 group-hover:opacity-100 transition"
          title="Item history"
        >
          <Info size={12} />
        </button>
        {ctx.openHistoryFor === item.id && (
          <PackingItemHistory
            itemId={item.id}
            participants={ctx.participants}
            onClose={() => ctx.setOpenHistoryFor(null)}
          />
        )}
      </div>

      <button
        onClick={() => ctx.deleteItem(item)}
        className="text-[var(--ink-3)] hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition"
        title="Remove (restorable from history)"
      >
        <Trash2 size={12} />
      </button>
    </li>
  );
}
