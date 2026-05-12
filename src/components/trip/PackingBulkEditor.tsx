"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { PackingItem, Participant } from "@/lib/types";
import { toText, fromText, diff } from "@/lib/packing-text";
import { X, Sparkles, RotateCcw } from "lucide-react";

interface PackingBulkEditorProps {
  tripId: string;
  items: PackingItem[];
  participants: Participant[];
  onCancel: () => void;
  onSave: (result: ReturnType<typeof diff>) => Promise<void>;
}

export default function PackingBulkEditor({
  tripId,
  items,
  participants,
  onCancel,
  onSave,
}: PackingBulkEditorProps) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [cleaning, setCleaning] = useState(false);
  const [preClean, setPreClean] = useState<string | null>(null);
  const [justCleaned, setJustCleaned] = useState(false);

  async function aiCleanUp() {
    setCleaning(true);
    setError("");
    setPreClean(text); // snapshot for undo
    try {
      const res = await fetch("/api/clean-packing-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw: text, tripId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (typeof data.cleaned === "string" && data.cleaned.trim()) {
        setText(data.cleaned);
        setJustCleaned(true);
      } else {
        setError("AI didn't return a usable result. Try editing manually.");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "AI clean-up failed.");
    } finally {
      setCleaning(false);
    }
  }

  function undoClean() {
    if (preClean !== null) {
      setText(preClean);
      setPreClean(null);
      setJustCleaned(false);
    }
  }

  useEffect(() => {
    setText(toText(items, participants));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live preview of the diff
  const parsed = fromText(text);
  const result = diff(items, parsed, participants);
  const totalChanges =
    result.toInsert.length +
    result.toSoftDelete.length +
    result.toUpdate.length +
    result.toReorder.length;

  async function save() {
    setSaving(true);
    setError("");
    try {
      await onSave(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  const modal = (
    <div
      className="fixed inset-0 z-[100] bg-black/30 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-[var(--paper-3)] px-5 py-3 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-[var(--ink)]">Edit packing list</h2>
            <p className="text-xs text-[var(--ink-3)] mt-0.5">
              Edit freely or paste anything. AI can clean & categorize before you commit.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-[var(--ink-3)] hover:text-[var(--ink)] p-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {justCleaned && (
            <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-900">
              <span>
                ✨ AI restructured your list. Review below, edit anything you want, then Save.
              </span>
              <button
                onClick={undoClean}
                className="flex items-center gap-1 text-xs font-medium hover:underline"
              >
                <RotateCcw size={11} />
                Undo
              </button>
            </div>
          )}

          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setJustCleaned(false);
            }}
            spellCheck={false}
            rows={20}
            className="w-full text-sm bg-[var(--paper-2)] rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none font-mono border border-[var(--paper-3)] leading-relaxed"
            placeholder={`Type or paste anything — list, headers optional. AI clean up will sort it.\n\nOr use the canonical format:\nSHARED · Gear\n- Tent (3p) — Albert\n\nPERSONAL · Clothing\n- Rain shell`}
          />

          <div className="text-xs text-[var(--ink-3)] space-y-1">
            <p>
              <span className="font-medium text-[var(--ink-2)]">Format:</span> headers like{" "}
              <code className="bg-[var(--paper-2)] px-1 rounded">SHARED · Gear</code> set the
              scope and category. Items start with <code className="bg-[var(--paper-2)] px-1 rounded">-</code>.
              Add an assignee on shared items with{" "}
              <code className="bg-[var(--paper-2)] px-1 rounded">— Name</code>.
            </p>
            <p>
              Categories: <code>Gear</code>, <code>Clothing</code>, <code>Food</code>,{" "}
              <code>Documents</code>, <code>Other</code>.
            </p>
          </div>

          {/* Live diff preview */}
          <div className="bg-[var(--paper-2)] rounded-lg px-3 py-2.5 border border-[var(--paper-3)] text-xs">
            <p className="font-semibold text-[var(--ink-2)] mb-1.5">
              {totalChanges === 0 ? "No changes" : `${totalChanges} pending change${totalChanges === 1 ? "" : "s"}`}
            </p>
            {result.toInsert.length > 0 && (
              <p className="text-[var(--green)]">
                + add {result.toInsert.length}: {result.toInsert.map((i) => i.label).slice(0, 3).join(", ")}
                {result.toInsert.length > 3 && ` and ${result.toInsert.length - 3} more`}
              </p>
            )}
            {result.toSoftDelete.length > 0 && (
              <p className="text-red-600">
                − remove {result.toSoftDelete.length}:{" "}
                {result.toSoftDelete.map((i) => i.label).slice(0, 3).join(", ")}
                {result.toSoftDelete.length > 3 && ` and ${result.toSoftDelete.length - 3} more`}
              </p>
            )}
            {result.toUpdate.length > 0 && (
              <p className="text-[var(--accent)]">
                ↻ reassign {result.toUpdate.length}:{" "}
                {result.toUpdate.map((u) => u.oldLabel).slice(0, 3).join(", ")}
                {result.toUpdate.length > 3 && ` and ${result.toUpdate.length - 3} more`}
              </p>
            )}
            {result.toReorder.length > 0 && (
              <p className="text-[var(--ink-3)]">
                ↕ reorder {result.toReorder.length} item{result.toReorder.length === 1 ? "" : "s"}
              </p>
            )}
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--paper-3)] px-5 py-3 flex items-center justify-between gap-2 flex-wrap">
          <button
            onClick={aiCleanUp}
            disabled={cleaning || !text.trim()}
            className="flex items-center gap-1.5 text-sm bg-[var(--paper-2)] hover:bg-[var(--paper-3)] text-[var(--ink-2)] border border-[var(--paper-3)] px-3 py-1.5 rounded-lg disabled:opacity-40"
            title="Let AI restructure, categorize, and infer shared/personal scope"
          >
            <Sparkles size={13} className="text-[var(--accent)]" />
            {cleaning ? "Cleaning up…" : "AI clean up"}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="text-sm text-[var(--ink-3)] px-3 py-1.5 hover:text-[var(--ink)]"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving || totalChanges === 0}
              className="text-sm bg-[var(--accent)] text-white px-4 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-40"
            >
              {saving
                ? "Saving…"
                : totalChanges === 0
                ? "No changes"
                : `Save ${totalChanges} change${totalChanges === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof window === "undefined") return null;
  return createPortal(modal, document.body);
}
