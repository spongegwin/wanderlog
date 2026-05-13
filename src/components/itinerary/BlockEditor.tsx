"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import type {
  ItineraryBlock,
  BlockType,
  BlockStatus,
  HikeDifficulty,
  TransportMode,
} from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity";
import { X, Trash2 } from "lucide-react";

const TYPES: BlockType[] = [
  "flight", "stay", "activity", "meal", "transport", "hike", "rest", "idea",
];
const STATUSES: BlockStatus[] = ["idea", "suggested", "confirmed", "completed"];
const DIFFICULTIES: HikeDifficulty[] = ["easy", "moderate", "strenuous"];
const TRANSPORT_MODES: TransportMode[] = ["drive", "ferry", "flight", "transit", "walk", "other"];

interface BlockEditorProps {
  block: ItineraryBlock;
  allDayLabels: string[];
  currentUserId: string | null;
  currentUserName: string | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
  onEditWaypoints?: () => void;
}

const inputCls =
  "w-full border border-[var(--paper-3)] rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)] bg-white";

export default function BlockEditor({
  block,
  allDayLabels,
  currentUserId,
  currentUserName,
  onClose,
  onSaved,
  onDeleted,
  onEditWaypoints,
}: BlockEditorProps) {
  const [form, setForm] = useState<ItineraryBlock>(block);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function update<K extends keyof ItineraryBlock>(key: K, value: ItineraryBlock[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true);
    const supabase = createClient();
    // Strip read-only / system fields
    const {
      id: _id,
      trip_id: _tid,
      added_by: _ab,
      created_at: _ca,
      ...payload
    } = form;
    void _id; void _tid; void _ab; void _ca;
    await supabase
      .from("itinerary_blocks")
      .update(payload as Record<string, unknown>)
      .eq("id", block.id);

    if (currentUserId) {
      const statusChanged = form.status !== block.status;
      const summary = statusChanged
        ? `marked ${form.title} as ${form.status}`
        : `edited ${form.title}`;
      await logActivity(supabase, {
        tripId: block.trip_id,
        userId: currentUserId,
        actorName: currentUserName,
        action: statusChanged ? "status.changed" : "block.edited",
        targetId: block.id,
        summary,
      });
    }

    setSaving(false);
    onSaved();
    onClose();
  }

  async function deleteBlock() {
    setSaving(true);
    const supabase = createClient();
    const { error, count } = await supabase
      .from("itinerary_blocks")
      .delete({ count: "exact" })
      .eq("id", block.id);
    setSaving(false);

    if (error || count === 0) {
      // RLS or FK denied the delete — show feedback instead of pretending.
      alert(error?.message ?? "Couldn't delete this block. Check that you have permission.");
      return;
    }

    if (currentUserId) {
      await logActivity(supabase, {
        tripId: block.trip_id,
        userId: currentUserId,
        actorName: currentUserName,
        action: "block.deleted",
        targetId: block.id,
        summary: `deleted ${block.title}`,
      });
    }

    onDeleted();
    onClose();
  }

  const isHike = form.type === "hike" || form.type === "rest";
  const isTransport = form.type === "transport" || form.type === "flight";
  const [estimating, setEstimating] = useState(false);

  async function estimateRoute() {
    if (!form.from_location || !form.to_location) return;
    setEstimating(true);
    try {
      const res = await fetch("/api/estimate-route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: form.from_location,
          to: form.to_location,
          mode: form.transport_mode ?? (form.type === "flight" ? "flight" : "drive"),
        }),
      });
      const data = await res.json();
      if (data.distance_mi != null) update("distance_mi", data.distance_mi);
      if (data.duration_min != null) update("duration_min", data.duration_min);
    } finally {
      setEstimating(false);
    }
  }

  const modal = (
    <div
      className="fixed inset-0 z-[100] bg-black/30 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-[var(--paper-3)] px-5 py-3 flex items-center justify-between z-10">
          <h2 className="font-semibold text-[var(--ink)]">Edit block</h2>
          <button
            onClick={onClose}
            className="text-[var(--ink-3)] hover:text-[var(--ink)] p-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          <Field label="Title">
            <input
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              className={inputCls}
            />
          </Field>

          <Field label="Subtitle">
            <input
              value={form.subtitle ?? ""}
              onChange={(e) => update("subtitle", e.target.value || null)}
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select
                value={form.type}
                onChange={(e) => update("type", e.target.value as BlockType)}
                className={inputCls}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select
                value={form.status}
                onChange={(e) => update("status", e.target.value as BlockStatus)}
                className={inputCls}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input
                type="date"
                value={form.date ?? ""}
                onChange={(e) => {
                  const v = e.target.value || null;
                  update("date", v);
                  // Auto-fill day_label from date if blank or matches the old auto-format
                  if (v) {
                    const d = new Date(v + "T00:00:00");
                    const label = d.toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    });
                    if (!form.day_label || form.day_label === form.day_label?.trim()) {
                      update("day_label", label);
                    }
                  }
                }}
                className={inputCls}
              />
            </Field>
            <Field label="Label (optional)">
              <input
                value={form.day_label ?? ""}
                onChange={(e) => update("day_label", e.target.value || null)}
                placeholder="e.g. Day 1 · night"
                className={inputCls}
              />
            </Field>
          </div>
          {allDayLabels.length > 0 && (
            <div className="flex flex-wrap gap-1 -mt-2">
              <span className="text-xs text-[var(--ink-3)] mr-1 self-center">Quick:</span>
              {allDayLabels.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => update("day_label", d)}
                  className={`text-xs px-2 py-0.5 rounded-full transition ${
                    form.day_label === d
                      ? "bg-[var(--ink)] text-white"
                      : "bg-[var(--paper-2)] text-[var(--ink-3)] hover:bg-[var(--paper-3)]"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-[var(--paper-3)] space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">
              Booking
            </p>
            <Field label="Confirmation #">
              <input
                value={form.booking_conf ?? ""}
                onChange={(e) => update("booking_conf", e.target.value || null)}
                className={inputCls}
              />
            </Field>
            <Field label="Details">
              <textarea
                value={form.booking_details ?? ""}
                onChange={(e) => update("booking_details", e.target.value || null)}
                rows={2}
                className={inputCls}
              />
            </Field>
            <Field label="Booking link">
              <input
                value={form.booking_link ?? ""}
                onChange={(e) => update("booking_link", e.target.value || null)}
                placeholder="https://..."
                className={inputCls}
              />
            </Field>
            <Field label="Cancel deadline">
              <input
                type="date"
                value={form.cancel_deadline ?? ""}
                onChange={(e) => update("cancel_deadline", e.target.value || null)}
                className={inputCls}
              />
            </Field>
          </div>

          {isTransport && (
            <div className="pt-2 border-t border-[var(--paper-3)] space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">
                Transportation
              </p>

              <Field label="Mode">
                <select
                  value={form.transport_mode ?? (form.type === "flight" ? "flight" : "drive")}
                  onChange={(e) => update("transport_mode", e.target.value as TransportMode)}
                  className={inputCls}
                >
                  {TRANSPORT_MODES.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="From">
                  <input
                    value={form.from_location ?? ""}
                    onChange={(e) => update("from_location", e.target.value || null)}
                    placeholder="San Francisco, CA"
                    className={inputCls}
                  />
                </Field>
                <Field label="To">
                  <input
                    value={form.to_location ?? ""}
                    onChange={(e) => update("to_location", e.target.value || null)}
                    placeholder="Long Beach, CA"
                    className={inputCls}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                <Field label="Distance (mi)">
                  <input
                    type="number"
                    step="0.1"
                    value={form.distance_mi ?? ""}
                    onChange={(e) =>
                      update("distance_mi", e.target.value ? Number(e.target.value) : null)
                    }
                    className={inputCls}
                  />
                </Field>
                <Field label="Duration (min)">
                  <input
                    type="number"
                    value={form.duration_min ?? ""}
                    onChange={(e) =>
                      update("duration_min", e.target.value ? Number(e.target.value) : null)
                    }
                    className={inputCls}
                  />
                </Field>
                <button
                  type="button"
                  onClick={estimateRoute}
                  disabled={estimating || !form.from_location || !form.to_location}
                  className="text-xs bg-[var(--accent)] text-white px-3 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed h-[34px]"
                  title="Ask AI to estimate distance & time"
                >
                  {estimating ? "…" : "Estimate"}
                </button>
              </div>
            </div>
          )}

          {isHike && (
            <div className="pt-2 border-t border-[var(--paper-3)] space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">
                  Hike
                </p>
                {onEditWaypoints && (
                  <button
                    type="button"
                    onClick={() => {
                      onEditWaypoints();
                      onClose();
                    }}
                    className="text-xs text-[var(--accent)] hover:underline"
                  >
                    Edit waypoints →
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start">
                  <input
                    value={form.hike_start ?? ""}
                    onChange={(e) => update("hike_start", e.target.value || null)}
                    className={inputCls}
                  />
                </Field>
                <Field label="End">
                  <input
                    value={form.hike_end ?? ""}
                    onChange={(e) => update("hike_end", e.target.value || null)}
                    className={inputCls}
                  />
                </Field>
                <Field label="Start elev">
                  <input
                    value={form.hike_start_elev ?? ""}
                    onChange={(e) => update("hike_start_elev", e.target.value || null)}
                    placeholder="10 ft"
                    className={inputCls}
                  />
                </Field>
                <Field label="End elev">
                  <input
                    value={form.hike_end_elev ?? ""}
                    onChange={(e) => update("hike_end_elev", e.target.value || null)}
                    placeholder="1,620 ft"
                    className={inputCls}
                  />
                </Field>
                <Field label="Distance">
                  <input
                    value={form.hike_distance ?? ""}
                    onChange={(e) => update("hike_distance", e.target.value || null)}
                    placeholder="13.1 mi"
                    className={inputCls}
                  />
                </Field>
                <Field label="Elev gain">
                  <input
                    value={form.hike_elev_gain ?? ""}
                    onChange={(e) => update("hike_elev_gain", e.target.value || null)}
                    placeholder="3,400 ft"
                    className={inputCls}
                  />
                </Field>
                <Field label="Est hours">
                  <input
                    value={form.hike_est_hours ?? ""}
                    onChange={(e) => update("hike_est_hours", e.target.value || null)}
                    placeholder="6-7 hrs"
                    className={inputCls}
                  />
                </Field>
                <Field label="Difficulty">
                  <select
                    value={form.hike_difficulty ?? ""}
                    onChange={(e) =>
                      update(
                        "hike_difficulty",
                        (e.target.value || null) as HikeDifficulty | null
                      )
                    }
                    className={inputCls}
                  >
                    <option value="">—</option>
                    {DIFFICULTIES.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <label className="flex items-center gap-2 text-sm text-[var(--ink-2)]">
                <input
                  type="checkbox"
                  checked={form.hike_has_variant}
                  onChange={(e) => update("hike_has_variant", e.target.checked)}
                />
                Has variant
              </label>

              {form.hike_has_variant && (
                <Field label="Variant note">
                  <textarea
                    value={form.hike_variant_note ?? ""}
                    onChange={(e) => update("hike_variant_note", e.target.value || null)}
                    rows={2}
                    className={inputCls}
                  />
                </Field>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-[var(--paper-3)] px-5 py-3 flex items-center justify-between z-10">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-red-600">Delete this block?</span>
              <button
                onClick={deleteBlock}
                disabled={saving}
                className="text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 disabled:opacity-50"
              >
                Yes, delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-sm text-[var(--ink-3)] hover:text-[var(--ink)]"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-sm text-red-600 hover:bg-red-50 px-3 py-1.5 rounded flex items-center gap-1.5"
            >
              <Trash2 size={14} />
              Delete
            </button>
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="text-sm text-[var(--ink-3)] px-3 py-1.5 hover:text-[var(--ink)]"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="text-sm bg-[var(--accent)] text-white px-4 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof window === "undefined") return null;
  return createPortal(modal, document.body);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[var(--ink-3)]">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
