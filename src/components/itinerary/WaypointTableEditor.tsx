"use client";

import { useState } from "react";
import type { HikeWaypoint } from "@/lib/types";
import { recalcWaypoints } from "@/lib/waypoints";
import WaypointImporter from "./WaypointImporter";
import { Plus, Trash2, Upload, Coffee, GripVertical, ChevronUp, ChevronDown } from "lucide-react";

const FT_TO_M = 0.3048;
const MI_TO_KM = 1.60934;

interface WaypointTableEditorProps {
  initial: HikeWaypoint[];
  onSave: (waypoints: HikeWaypoint[]) => void;
  onCancel: () => void;
}

export default function WaypointTableEditor({
  initial,
  onSave,
  onCancel,
}: WaypointTableEditorProps) {
  const [rows, setRows] = useState<HikeWaypoint[]>(
    initial.length ? initial : [{ location: "" }]
  );
  const [showImporter, setShowImporter] = useState(false);
  const [units, setUnits] = useState<"imperial" | "metric">("imperial");
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const isMetric = units === "metric";

  const toDisplayElev = (ft: number | null | undefined) =>
    ft == null ? "" : isMetric ? String(Math.round(ft * FT_TO_M)) : String(ft);
  const toDisplayDist = (mi: number | null | undefined) =>
    mi == null ? "" : isMetric ? (mi * MI_TO_KM).toFixed(2) : String(mi);
  const fromInputElev = (val: string) => {
    const n = parseFloat(val);
    if (isNaN(n)) return null;
    return isMetric ? Math.round(n / FT_TO_M) : Math.round(n);
  };
  const fromInputDist = (val: string) => {
    const n = parseFloat(val);
    if (isNaN(n)) return null;
    return isMetric ? Math.round((n / MI_TO_KM) * 1000) / 1000 : Math.round(n * 100) / 100;
  };

  function update(i: number, patch: Partial<HikeWaypoint>) {
    const next = rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    setRows(recalcWaypoints(next));
  }

  function insertAt(i: number, isBreak: boolean) {
    const next = [...rows];
    next.splice(i + 1, 0, isBreak ? { location: "Break", is_break: true } : { location: "" });
    setRows(recalcWaypoints(next));
  }

  function addRow() {
    setRows((prev) => recalcWaypoints([...prev, { location: "" }]));
  }

  function addBreak() {
    setRows((prev) => recalcWaypoints([...prev, { location: "Break", is_break: true }]));
  }

  function removeRow(i: number) {
    const next = rows.filter((_, idx) => idx !== i);
    setRows(recalcWaypoints(next.length ? next : [{ location: "" }]));
  }

  function moveUp(i: number) {
    if (i === 0) return;
    const next = [...rows];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    setRows(recalcWaypoints(next));
  }

  function moveDown(i: number) {
    if (i === rows.length - 1) return;
    const next = [...rows];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    setRows(recalcWaypoints(next));
  }

  function handleDragEnd() {
    if (dragIdx !== null && overIdx !== null && dragIdx !== overIdx) {
      const next = [...rows];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(overIdx, 0, moved);
      setRows(recalcWaypoints(next));
    }
    setDragIdx(null);
    setOverIdx(null);
  }

  function handleImport(waypoints: HikeWaypoint[], mode: "replace" | "append") {
    const next = mode === "replace" ? waypoints : [...rows, ...waypoints];
    setRows(recalcWaypoints(next));
    setShowImporter(false);
  }

  const startTime = rows[0]?.time ?? "";

  return (
    <div className="space-y-3">
      {showImporter ? (
        <WaypointImporter
          existingCount={rows.filter((r) => r.location).length}
          onImport={handleImport}
          onCancel={() => setShowImporter(false)}
        />
      ) : (
        <>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-[var(--ink-2)]">Start time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => update(0, { time: e.target.value })}
                className="text-xs border border-[var(--paper-3)] rounded px-2 py-1 font-mono"
              />
            </div>
            <button
              onClick={() => setUnits((u) => (u === "imperial" ? "metric" : "imperial"))}
              className="text-[10px] font-medium border border-[var(--paper-3)] rounded-full px-2 py-0.5 text-[var(--ink-3)] hover:bg-[var(--paper-2)] transition"
            >
              {isMetric ? "km / m" : "mi / ft"}
            </button>
          </div>

          {/* Mobile card layout */}
          <div className="block sm:hidden space-y-3">
            {rows.map((wp, i) => (
              <div
                key={i}
                className={`rounded-lg p-3 space-y-2 border ${
                  wp.is_break
                    ? "bg-[var(--paper-2)] border-[var(--paper-3)]"
                    : "bg-white border-[var(--paper-3)]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-wide font-semibold text-[var(--ink-3)]">
                    {wp.is_break ? "☕ Break" : `Stop ${i + 1}`}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => moveUp(i)}
                      disabled={i === 0}
                      className="text-[var(--ink-3)] disabled:opacity-20 p-1"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      onClick={() => moveDown(i)}
                      disabled={i === rows.length - 1}
                      className="text-[var(--ink-3)] disabled:opacity-20 p-1"
                    >
                      <ChevronDown size={14} />
                    </button>
                    <button
                      onClick={() => insertAt(i, false)}
                      title="Insert waypoint after"
                      className="text-[var(--ink-3)] p-1"
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      onClick={() => insertAt(i, true)}
                      title="Insert break after"
                      className="text-[var(--ink-3)] p-1"
                    >
                      <Coffee size={14} />
                    </button>
                    <button
                      onClick={() => removeRow(i)}
                      className="text-[var(--ink-3)] hover:text-red-500 p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <input
                  value={wp.location}
                  onChange={(e) => update(i, { location: e.target.value })}
                  placeholder={wp.is_break ? "Break description" : "Waypoint name"}
                  className="w-full text-sm border border-[var(--paper-3)] rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />

                {!wp.is_break && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <label className="flex flex-col gap-0.5">
                      <span className="text-[var(--ink-3)]">{isMetric ? "Elev m" : "Elev ft"}</span>
                      <input
                        type="number"
                        value={toDisplayElev(wp.elevation_ft)}
                        onChange={(e) => update(i, { elevation_ft: fromInputElev(e.target.value) })}
                        placeholder="—"
                        className="border border-[var(--paper-3)] rounded px-2 py-1"
                      />
                    </label>
                    <label className="flex flex-col gap-0.5">
                      <span className="text-[var(--ink-3)]">{isMetric ? "↑ Gain m" : "↑ Gain ft"}</span>
                      <input
                        type="number"
                        value={toDisplayElev(wp.gain_ft)}
                        onChange={(e) => update(i, { gain_ft: fromInputElev(e.target.value) })}
                        placeholder="—"
                        className="border border-[var(--paper-3)] rounded px-2 py-1"
                      />
                    </label>
                    <label className="flex flex-col gap-0.5">
                      <span className="text-[var(--ink-3)]">{isMetric ? "Segment km" : "Segment mi"}</span>
                      <input
                        type="number"
                        step="0.1"
                        value={toDisplayDist(wp.dist_mi)}
                        onChange={(e) => update(i, { dist_mi: fromInputDist(e.target.value) })}
                        placeholder="—"
                        className="border border-[var(--paper-3)] rounded px-2 py-1"
                      />
                    </label>
                    <label className="flex flex-col gap-0.5">
                      <span className="text-[var(--ink-3)]">Duration H:MM</span>
                      <input
                        value={wp.duration ?? ""}
                        onChange={(e) => update(i, { duration: e.target.value || null })}
                        placeholder="H:MM"
                        className="border border-[var(--paper-3)] rounded px-2 py-1 font-mono"
                      />
                    </label>
                  </div>
                )}

                {wp.is_break && (
                  <label className="flex flex-col gap-0.5 text-xs">
                    <span className="text-[var(--ink-3)]">Duration H:MM</span>
                    <input
                      value={wp.duration ?? ""}
                      onChange={(e) => update(i, { duration: e.target.value || null })}
                      placeholder="0:15"
                      className="border border-[var(--paper-3)] rounded px-2 py-1 font-mono"
                    />
                  </label>
                )}

                {!wp.is_break && (
                  <div className="flex justify-between text-xs text-[var(--ink-3)] pt-1">
                    <span>
                      Total:{" "}
                      <span className="tabular-nums text-[var(--ink-2)]">
                        {wp.total_dist_mi != null
                          ? isMetric
                            ? `${(wp.total_dist_mi * MI_TO_KM).toFixed(1)} km`
                            : `${wp.total_dist_mi.toFixed(1)} mi`
                          : "—"}
                      </span>
                    </span>
                    <span>
                      ETA:{" "}
                      <span className="font-mono text-[var(--ink-2)]">{wp.time ?? "—"}</span>
                    </span>
                  </div>
                )}

                {!wp.is_break && (
                  <input
                    value={wp.escape ?? ""}
                    onChange={(e) => update(i, { escape: e.target.value || null })}
                    placeholder="Escape route (optional)"
                    className="w-full text-xs border border-[var(--paper-3)] rounded px-2 py-1 outline-none"
                  />
                )}
              </div>
            ))}
          </div>

          {/* Desktop table layout */}
          <div className="hidden sm:block overflow-x-auto -mx-1">
            <table className="w-full text-xs border-collapse min-w-[760px]">
              <thead>
                <tr className="text-[var(--ink-3)] border-b border-[var(--paper-3)]">
                  <th className="w-5" />
                  <th className="text-left py-1.5 pr-2 font-medium">Location</th>
                  <th className="text-right py-1.5 px-1 font-medium w-16">
                    {isMetric ? "Elev m" : "Elev ft"}
                  </th>
                  <th className="text-right py-1.5 px-1 font-medium w-14">
                    {isMetric ? "↑ m" : "↑ ft"}
                  </th>
                  <th className="text-right py-1.5 px-1 font-medium w-12">
                    {isMetric ? "km" : "mi"}
                  </th>
                  <th className="text-right py-1.5 px-1 font-medium w-14">
                    {isMetric ? "Total km" : "Total mi"}
                  </th>
                  <th className="text-right py-1.5 px-1 font-medium w-16">Duration</th>
                  <th className="text-right py-1.5 px-1 font-medium w-14">ETA</th>
                  <th className="text-left py-1.5 px-1 font-medium w-24">Escape</th>
                  <th className="text-right py-1.5 px-1 font-medium w-20">Lat</th>
                  <th className="text-right py-1.5 px-1 font-medium w-20">Lon</th>
                  <th className="w-20" />
                </tr>
              </thead>
              <tbody>
                {rows.map((wp, i) => (
                  <tr
                    key={i}
                    draggable
                    onDragStart={(e) => {
                      setDragIdx(i);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      if (overIdx !== i) setOverIdx(i);
                    }}
                    onDragEnd={handleDragEnd}
                    onDrop={(e) => e.preventDefault()}
                    className={`border-b border-[var(--paper-2)] group cursor-default transition-opacity ${
                      dragIdx === i ? "opacity-40" : "opacity-100"
                    } ${
                      overIdx === i && dragIdx !== i
                        ? "outline outline-2 outline-[var(--accent)] outline-offset-[-1px]"
                        : ""
                    }`}
                  >
                    <td className="pr-1 align-middle w-5">
                      <div
                        className="cursor-grab active:cursor-grabbing text-[var(--ink-3)] hover:text-[var(--ink)] flex items-center justify-center"
                        title="Drag to reorder"
                      >
                        <GripVertical size={13} />
                      </div>
                    </td>
                    <td className="pr-2 py-1">
                      <input
                        value={wp.location}
                        onChange={(e) => update(i, { location: e.target.value })}
                        placeholder={wp.is_break ? "Break description" : "Waypoint name"}
                        className={`w-full border border-transparent focus:border-[var(--paper-3)] rounded px-1.5 py-0.5 outline-none bg-transparent focus:bg-white ${
                          wp.is_break ? "italic text-[var(--ink-3)]" : ""
                        }`}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        type="number"
                        step="1"
                        value={toDisplayElev(wp.elevation_ft)}
                        onChange={(e) => update(i, { elevation_ft: fromInputElev(e.target.value) })}
                        placeholder="—"
                        className="w-full text-right border border-transparent focus:border-[var(--paper-3)] rounded px-1 py-0.5 outline-none bg-transparent focus:bg-white"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        type="number"
                        step="1"
                        value={toDisplayElev(wp.gain_ft)}
                        onChange={(e) => update(i, { gain_ft: fromInputElev(e.target.value) })}
                        placeholder="—"
                        className="w-full text-right border border-transparent focus:border-[var(--paper-3)] rounded px-1 py-0.5 outline-none bg-transparent focus:bg-white"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        type="number"
                        step="0.1"
                        value={toDisplayDist(wp.dist_mi)}
                        onChange={(e) => update(i, { dist_mi: fromInputDist(e.target.value) })}
                        placeholder="—"
                        className="w-full text-right border border-transparent focus:border-[var(--paper-3)] rounded px-1 py-0.5 outline-none bg-transparent focus:bg-white"
                      />
                    </td>
                    <td className="px-1 py-1 text-right text-[var(--ink-3)] tabular-nums">
                      {wp.total_dist_mi != null
                        ? isMetric
                          ? (wp.total_dist_mi * MI_TO_KM).toFixed(1)
                          : wp.total_dist_mi.toFixed(1)
                        : "—"}
                    </td>
                    <td className="px-1 py-1">
                      <input
                        value={wp.duration ?? ""}
                        onChange={(e) => update(i, { duration: e.target.value || null })}
                        placeholder="H:MM"
                        className="w-full text-right font-mono border border-transparent focus:border-[var(--paper-3)] rounded px-1 py-0.5 outline-none bg-transparent focus:bg-white"
                      />
                    </td>
                    <td className="px-1 py-1 text-right font-mono text-[var(--ink-2)] tabular-nums">
                      {wp.time ?? "—"}
                    </td>
                    <td className="px-1 py-1">
                      <input
                        value={wp.escape ?? ""}
                        onChange={(e) => update(i, { escape: e.target.value || null })}
                        placeholder="escape…"
                        className="w-full border border-transparent focus:border-[var(--paper-3)] rounded px-1 py-0.5 outline-none bg-transparent focus:bg-white"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        type="number"
                        step="0.0001"
                        value={wp.lat ?? ""}
                        onChange={(e) =>
                          update(i, { lat: e.target.value ? parseFloat(e.target.value) : null })
                        }
                        placeholder="lat"
                        className="w-full text-right font-mono text-[10px] border border-transparent focus:border-[var(--paper-3)] rounded px-1 py-0.5 outline-none bg-transparent focus:bg-white"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        type="number"
                        step="0.0001"
                        value={wp.lon ?? ""}
                        onChange={(e) =>
                          update(i, { lon: e.target.value ? parseFloat(e.target.value) : null })
                        }
                        placeholder="lon"
                        className="w-full text-right font-mono text-[10px] border border-transparent focus:border-[var(--paper-3)] rounded px-1 py-0.5 outline-none bg-transparent focus:bg-white"
                      />
                    </td>
                    <td className="pl-1 py-1">
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => insertAt(i, false)}
                          title="Insert waypoint after"
                          className="text-[var(--ink-3)] hover:text-[var(--accent)] p-0.5"
                        >
                          <Plus size={11} />
                        </button>
                        <button
                          onClick={() => insertAt(i, true)}
                          title="Insert break after"
                          className="text-[var(--ink-3)] hover:text-[var(--accent)] p-0.5"
                        >
                          <Coffee size={11} />
                        </button>
                        <button
                          onClick={() => removeRow(i)}
                          title="Delete row"
                          className="text-[var(--ink-3)] hover:text-red-500 p-0.5"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={addRow}
              className="flex items-center gap-1.5 text-xs border border-[var(--paper-3)] text-[var(--ink-2)] px-3 py-1.5 rounded-lg hover:bg-[var(--paper-2)] transition"
            >
              <Plus size={12} />
              Add waypoint
            </button>
            <button
              onClick={addBreak}
              className="flex items-center gap-1.5 text-xs border border-[var(--paper-3)] text-[var(--ink-2)] px-3 py-1.5 rounded-lg hover:bg-[var(--paper-2)] transition"
            >
              <Coffee size={12} />
              Add break
            </button>
            <button
              onClick={() => setShowImporter(true)}
              className="flex items-center gap-1.5 text-xs border border-[var(--paper-3)] text-[var(--ink-2)] px-3 py-1.5 rounded-lg hover:bg-[var(--paper-2)] transition"
            >
              <Upload size={12} />
              Import
            </button>
          </div>

          <div className="flex gap-2 pt-1 border-t border-[var(--paper-3)]">
            <button
              onClick={() => onSave(rows.filter((r) => r.location.trim()))}
              className="text-sm bg-[var(--green)] text-white px-4 py-1.5 rounded-lg hover:opacity-90 transition"
            >
              Save waypoints
            </button>
            <button
              onClick={onCancel}
              className="text-sm text-[var(--ink-3)] px-3 py-1.5 rounded-lg hover:bg-[var(--paper-3)] transition"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
