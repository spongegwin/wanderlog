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
  Sparkles, Plus, Trash2, Check, History, Upload, Info, Pencil,
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

  async function fetchItems() {
    const { data } = await supabase
      .from("packing_items")
      .select("*")
      .eq("trip_id", tripId)
      .is("deleted_at", null)
      .order("created_at");
    setItems((data ?? []) as PackingItem[]);
    setLoading(false);
  }

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  const myParticipant = participants.find((p) => p.user_id === currentUserId);

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
    const { data } = await supabase
      .from("packing_items")
      .insert({
        trip_id: tripId,
        label,
        category,
        scope,
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
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, category: newCategory } : i))
    );
    await supabase.from("packing_items").update({ category: newCategory }).eq("id", item.id);
    await log(
      "packing.recategorized",
      `moved ${item.label} from ${item.category} to ${newCategory}`,
      item.id
    );
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
        const rows = data.items.map(
          (it: { label: string; category: string; scope?: PackingScope }) => ({
            trip_id: tripId,
            label: it.label,
            category: CATEGORIES.includes(it.category) ? it.category : "Other",
            scope: it.scope === "personal" ? "personal" : "shared",
            created_by: currentUserId,
          })
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
    const rows = imported.map((it) => ({
      trip_id: tripId,
      label: it.label,
      category: CATEGORIES.includes(it.category) ? it.category : "Other",
      scope: (it as { scope?: PackingScope }).scope === "personal" ? "personal" : "shared",
      created_by: currentUserId,
    }));
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
    toInsert: Array<{ scope: PackingScope; category: string; label: string; assigneeName?: string | null }>;
    toSoftDelete: PackingItem[];
    toUpdate: Array<{ id: string; assigned_to: string | null; oldLabel: string; newAssigneeName: string | null }>;
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

    const total =
      result.toInsert.length + result.toSoftDelete.length + result.toUpdate.length;
    if (total > 0) {
      await log(
        "packing.bulk_imported",
        `edited list (${result.toInsert.length} added, ${result.toSoftDelete.length} removed, ${result.toUpdate.length} reassigned)`
      );
    }

    setShowBulkEditor(false);
    await fetchItems();
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
    const scope: PackingScope = (it.scope ?? "shared") === "personal" ? "personal" : "shared";
    const cat = CATEGORIES.includes(it.category) ? it.category : "Other";
    grouped[scope][cat].push(it);
  }

  const totalPacked = items.filter((i) => i.packed).length;

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

      {SCOPES.map((scope) => {
        const scopeItems = items.filter((i) => (i.scope ?? "shared") === scope);
        // Skip scope section if no items AND no other items exist (i.e. empty trip — show below the empty state)
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
              {CATEGORIES.map((cat) => {
                const itemsInCat = grouped[scope][cat];
                const addKey = `${scope}|${cat}`;
                return (
                  <section key={cat}>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)] mb-2">
                      {cat}
                      {itemsInCat.length > 0 && (
                        <span className="opacity-60"> · {itemsInCat.length}</span>
                      )}
                    </h3>
                    <ul className="space-y-1.5 mb-2">
                      {itemsInCat.map((item) => {
                        const assignee = item.assigned_to
                          ? participants.find((p) => p.id === item.assigned_to)
                          : null;
                        const isEditing = editingLabelId === item.id;
                        return (
                          <li
                            key={item.id}
                            className={`flex items-center gap-2 bg-white border border-[var(--paper-3)] rounded-lg px-3 py-2 group relative ${
                              item.packed ? "opacity-60" : ""
                            }`}
                          >
                            <button
                              onClick={() => togglePacked(item)}
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
                                value={labelDraft}
                                onChange={(e) => setLabelDraft(e.target.value)}
                                onBlur={() => renameItem(item, labelDraft)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") renameItem(item, labelDraft);
                                  else if (e.key === "Escape") setEditingLabelId(null);
                                }}
                                className="flex-1 text-sm bg-[var(--paper-2)] border border-[var(--paper-3)] rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-[var(--accent)]"
                              />
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingLabelId(item.id);
                                  setLabelDraft(item.label);
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
                                  setOpenCategoryFor(
                                    openCategoryFor === item.id ? null : item.id
                                  )
                                }
                                className="text-[10px] uppercase tracking-wide text-[var(--ink-3)] hover:text-[var(--ink)] bg-[var(--paper-2)] hover:bg-[var(--paper-3)] px-2 py-0.5 rounded-full"
                                title="Click to change category"
                              >
                                {item.category}
                              </button>
                              {openCategoryFor === item.id && (
                                <div className="absolute right-0 top-full mt-1 bg-white border border-[var(--paper-3)] rounded-lg shadow-md py-1 z-20">
                                  {CATEGORIES.map((c) => (
                                    <button
                                      key={c}
                                      onClick={() => recategorize(item, c)}
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
                            {scope === "shared" && (
                              <div className="relative">
                                <button
                                  onClick={() =>
                                    setOpenAssignFor(
                                      openAssignFor === item.id ? null : item.id
                                    )
                                  }
                                  className="flex items-center"
                                  title={
                                    assignee ? `Assigned to ${assignee.name}` : "Click to assign"
                                  }
                                >
                                  {assignee ? (
                                    <Avatar
                                      name={assignee.name}
                                      color={assignee.color}
                                      size="sm"
                                    />
                                  ) : (
                                    <span className="text-xs text-[var(--ink-3)] hover:text-[var(--ink)] px-2 py-1 rounded-full bg-[var(--paper-2)]">
                                      Claim
                                    </span>
                                  )}
                                </button>
                                {openAssignFor === item.id && (
                                  <div className="absolute right-0 top-full mt-1 bg-white border border-[var(--paper-3)] rounded-lg shadow-md py-1 z-20 min-w-[140px]">
                                    <button
                                      onClick={() =>
                                        myParticipant && assign(item, myParticipant.id)
                                      }
                                      disabled={!myParticipant}
                                      className="block w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--paper-2)] disabled:opacity-50"
                                    >
                                      I'll bring it
                                    </button>
                                    {participants
                                      .filter((p) => p.user_id !== currentUserId)
                                      .map((p) => (
                                        <button
                                          key={p.id}
                                          onClick={() => assign(item, p.id)}
                                          className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--paper-2)]"
                                        >
                                          <Avatar name={p.name} color={p.color} size="sm" />
                                          {p.name}
                                        </button>
                                      ))}
                                    {item.assigned_to && (
                                      <button
                                        onClick={() => assign(item, null)}
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
                            {scope === "personal" && (
                              <span className="text-[10px] text-[var(--ink-3)] italic">
                                everyone
                              </span>
                            )}

                            {/* History info */}
                            <div className="relative">
                              <button
                                onClick={() =>
                                  setOpenHistoryFor(
                                    openHistoryFor === item.id ? null : item.id
                                  )
                                }
                                className="text-[var(--ink-3)] hover:text-[var(--ink)] p-1 opacity-0 group-hover:opacity-100 transition"
                                title="Item history"
                              >
                                <Info size={12} />
                              </button>
                              {openHistoryFor === item.id && (
                                <PackingItemHistory
                                  itemId={item.id}
                                  participants={participants}
                                  onClose={() => setOpenHistoryFor(null)}
                                />
                              )}
                            </div>

                            <button
                              onClick={() => deleteItem(item)}
                              className="text-[var(--ink-3)] hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition"
                              title="Remove (restorable from history)"
                            >
                              <Trash2 size={12} />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    {currentUserId && (
                      <div className="flex items-center gap-2">
                        <input
                          value={addLabel[addKey] ?? ""}
                          onChange={(e) =>
                            setAddLabel((prev) => ({ ...prev, [addKey]: e.target.value }))
                          }
                          onKeyDown={(e) => e.key === "Enter" && addItem(scope, cat)}
                          placeholder={`Add to ${cat.toLowerCase()}…`}
                          className="flex-1 text-sm bg-white border border-[var(--paper-3)] rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-[var(--accent)]"
                        />
                        <button
                          onClick={() => addItem(scope, cat)}
                          disabled={!(addLabel[addKey] ?? "").trim()}
                          className="text-sm text-[var(--accent)] disabled:opacity-30 p-1.5"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          </div>
        );
      })}

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
