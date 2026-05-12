"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ItineraryBlock } from "@/lib/types";
import { toTextSingleDay, fromTextSingleDay, diff } from "@/lib/block-text";
import { X, Sparkles, RotateCcw, AlertTriangle } from "lucide-react";

interface BlockBulkEditorProps {
  tripId: string;
  dayDate: string | null;
  dayLabel: string;
  blocks: ItineraryBlock[];
  onCancel: () => void;
  onSave: (result: ReturnType<typeof diff>) => Promise<void>;
}

export default function BlockBulkEditor({
  tripId,
  dayDate,
  dayLabel,
  blocks,
  onCancel,
  onSave,
}: BlockBulkEditorProps) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [cleaning, setCleaning] = useState(false);
  const [preClean, setPreClean] = useState<string | null>(null);
  const [justCleaned, setJustCleaned] = useState(false);

  useEffect(() => {
    setText(toTextSingleDay(blocks));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parsed = fromTextSingleDay(text, dayDate);
  const result = diff(blocks, parsed);
  const totalChanges =
    result.toInsert.length +
    result.toDelete.length +
    result.toUpdate.length +
    result.toReorder.length;

  async function aiCleanUp() {
    setCleaning(true);
    setError("");
    setPreClean(text);
    try {
      const res = await fetch("/api/clean-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw: text, tripId, dayDate, dayLabel }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (typeof data.cleaned === "string" && data.cleaned.trim()) {
        setText(data.cleaned);
        setJustCleaned(true);
      } else {
        setError("AI didn't return a usable result. Edit manually.");
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

  const hasDeletes = result.toDelete.length > 0;

  const modal = (
    <div
      className="fixed inset-0 z-[100] bg-black/30 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-[var(--paper-3)] px-5 py-3 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-[var(--ink)]">Edit {dayLabel}</h2>
            <p className="text-xs text-[var(--ink-3)] mt-0.5">
              One block per line. Pure text — no icons. AI can clean & categorize.
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
                ✨ AI restructured this day. Review below, edit anything, then Save.
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
            rows={14}
            className="w-full text-sm bg-[var(--paper-2)] rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none font-mono border border-[var(--paper-3)] leading-relaxed"
            placeholder={`- [confirmed] hike · Avalon → Blackjack Campsite\n- [confirmed] stay · Blackjack Campsite\n- [idea] meal · Coffee before ferry`}
          />

          <div className="text-xs text-[var(--ink-3)] space-y-1">
            <p>
              <span className="font-medium text-[var(--ink-2)]">Format:</span>{" "}
              <code className="bg-[var(--paper-2)] px-1 rounded">
                - [status] type · title
              </code>
            </p>
            <p>
              Statuses: <code>idea</code>, <code>suggested</code>, <code>confirmed</code>,{" "}
              <code>completed</code>. Types: <code>hike</code>, <code>stay</code>,{" "}
              <code>meal</code>, <code>transport</code>, <code>flight</code>,{" "}
              <code>activity</code>, <code>rest</code>, <code>idea</code>. New lines auto-land
              on {dayLabel}.
            </p>
          </div>

          {/* Live diff preview */}
          <div className="bg-[var(--paper-2)] rounded-lg px-3 py-2.5 border border-[var(--paper-3)] text-xs space-y-1">
            <p className="font-semibold text-[var(--ink-2)]">
              {totalChanges === 0
                ? "No changes"
                : `${totalChanges} pending change${totalChanges === 1 ? "" : "s"}`}
            </p>
            {result.toInsert.length > 0 && (
              <p className="text-[var(--green)]">
                + add {result.toInsert.length}:{" "}
                {result.toInsert.map((i) => i.title).slice(0, 3).join(", ")}
                {result.toInsert.length > 3 && ` and ${result.toInsert.length - 3} more`}
              </p>
            )}
            {result.toDelete.length > 0 && (
              <p className="text-red-600">
                − remove {result.toDelete.length}:{" "}
                {result.toDelete.map((i) => i.title).slice(0, 3).join(", ")}
                {result.toDelete.length > 3 && ` and ${result.toDelete.length - 3} more`}
              </p>
            )}
            {result.toUpdate.length > 0 && (
              <p className="text-[var(--accent)]">
                ↻ change {result.toUpdate.length}:{" "}
                {result.toUpdate.map((u) => u.title).slice(0, 3).join(", ")}
                {result.toUpdate.length > 3 && ` and ${result.toUpdate.length - 3} more`}
              </p>
            )}
            {result.toReorder.length > 0 && (
              <p className="text-[var(--ink-2)]">
                ↕ reorder {result.toReorder.length}:{" "}
                {result.toReorder.map((r) => r.title).slice(0, 3).join(", ")}
                {result.toReorder.length > 3 && ` and ${result.toReorder.length - 3} more`}
              </p>
            )}
          </div>

          {hasDeletes && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
              <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
              <p>
                <span className="font-medium">Deleted blocks are permanent.</span> Comments,
                votes, bookings, and waypoints on those blocks will be lost. Use the pencil
                icon on a single block for surgical edits.
              </p>
            </div>
          )}

          {error && <p className="text-xs text-red-600 whitespace-pre-wrap">{error}</p>}
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--paper-3)] px-5 py-3 flex items-center justify-between gap-2 flex-wrap">
          <button
            onClick={aiCleanUp}
            disabled={cleaning || !text.trim()}
            className="flex items-center gap-1.5 text-sm bg-[var(--paper-2)] hover:bg-[var(--paper-3)] text-[var(--ink-2)] border border-[var(--paper-3)] px-3 py-1.5 rounded-lg disabled:opacity-40"
            title="Let AI restructure, categorize, and infer types"
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
