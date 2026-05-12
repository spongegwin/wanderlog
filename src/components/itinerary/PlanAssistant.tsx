"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ItineraryBlock, ParsedBlock, HikeWaypoint, BlockStatus } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity";
import WaypointTable from "./WaypointTable";
import { X, Sparkles, Send, Check, Plus } from "lucide-react";

interface BlockSuggestion {
  kind: "block";
  reason: string;
  block: ParsedBlock;
}

interface WaypointsSuggestion {
  kind: "waypoints";
  reason: string;
  target_block_title: string;
  waypoints: HikeWaypoint[];
}

type Suggestion = BlockSuggestion | WaypointsSuggestion;

interface AssistantResponse {
  answer: string;
  suggestions: Suggestion[];
}

interface PlanAssistantProps {
  tripId: string;
  blocks: ItineraryBlock[];
  currentUserId: string;
  currentUserName: string | null;
  onClose: () => void;
  onAdded: () => void;
}

function dateToLabel(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric",
  });
}

const fieldCls =
  "text-xs border border-[var(--paper-3)] rounded px-2 py-1 outline-none focus:ring-1 focus:ring-[var(--accent)] bg-white";

export default function PlanAssistant({
  tripId,
  blocks,
  currentUserId,
  currentUserName,
  onClose,
  onAdded,
}: PlanAssistantProps) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AssistantResponse | null>(null);
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [added, setAdded] = useState<Set<number>>(new Set());

  // Editable copies of each block suggestion
  const [editedBlocks, setEditedBlocks] = useState<Record<number, ParsedBlock>>({});

  const supabase = createClient();

  const dateChips = (() => {
    const seen = new Set<string>();
    const out: { date: string; day_label: string | null }[] = [];
    for (const b of blocks) {
      if (b.date && !seen.has(b.date)) {
        seen.add(b.date);
        out.push({ date: b.date, day_label: b.day_label });
      }
    }
    out.sort((a, b) => a.date.localeCompare(b.date));
    return out;
  })();

  // When a new response arrives, seed editedBlocks from the suggestion data
  useEffect(() => {
    if (!response) return;
    const seed: Record<number, ParsedBlock> = {};
    response.suggestions.forEach((s, i) => {
      if (s.kind === "block") seed[i] = { ...s.block };
    });
    setEditedBlocks(seed);
    setDismissed(new Set());
    setAdded(new Set());
  }, [response]);

  async function ask() {
    if (!question.trim() || loading) return;
    setLoading(true);
    setError("");
    setResponse(null);
    try {
      const res = await fetch("/api/plan-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim(), tripId }),
      });
      const data = await res.json();
      if (data.error) {
        // Surface debug info so we can see what Claude actually returned
        if (data.debug?.raw_preview) {
          console.warn("plan-assist parse error", data.debug);
          setError(`${data.error}\n\n(Preview of AI response in browser console.)`);
        } else {
          setError(data.error);
        }
        return;
      }
      setResponse(data as AssistantResponse);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to ask.");
    } finally {
      setLoading(false);
    }
  }

  function updateBlock(i: number, patch: Partial<ParsedBlock>) {
    setEditedBlocks((prev) => ({ ...prev, [i]: { ...prev[i], ...patch } }));
  }

  async function addBlock(i: number) {
    const b = editedBlocks[i];
    if (!b) return;
    await supabase.from("itinerary_blocks").insert({
      trip_id: tripId,
      added_by: currentUserId,
      ...b,
    } as Record<string, unknown>);
    await logActivity(supabase, {
      tripId,
      userId: currentUserId,
      actorName: currentUserName,
      action: "block.created",
      summary: `added ${b.title} (via AI assist)`,
    });
    setAdded((prev) => new Set(prev).add(i));
    onAdded();
  }

  async function addWaypoints(i: number, s: WaypointsSuggestion) {
    // Fuzzy-match target block by title
    const targetTitle = s.target_block_title.toLowerCase().trim();
    let target = blocks.find((b) => b.title.toLowerCase().trim() === targetTitle);
    if (!target) {
      // Try contains
      target = blocks.find(
        (b) =>
          b.title.toLowerCase().includes(targetTitle) ||
          targetTitle.includes(b.title.toLowerCase().trim())
      );
    }
    if (!target) {
      setError(`Could not find hike "${s.target_block_title}" in this trip.`);
      return;
    }
    if (target.type !== "hike" && target.type !== "rest") {
      setError(`"${target.title}" is not a hike block — waypoints only apply to hikes.`);
      return;
    }
    // Merge into existing waypoints (append)
    const existing = Array.isArray(target.hike_waypoints)
      ? (target.hike_waypoints as HikeWaypoint[])
      : [];
    const next = [...existing, ...s.waypoints];
    await supabase
      .from("itinerary_blocks")
      .update({ hike_waypoints: next } as Record<string, unknown>)
      .eq("id", target.id);
    await logActivity(supabase, {
      tripId,
      userId: currentUserId,
      actorName: currentUserName,
      action: "block.edited",
      targetId: target.id,
      summary: `added ${s.waypoints.length} waypoints to ${target.title} (via AI assist)`,
    });
    setAdded((prev) => new Set(prev).add(i));
    onAdded();
  }

  const modal = (
    <div
      className="fixed inset-0 z-[100] bg-black/30 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-[var(--paper-3)] px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-[var(--accent)]" />
            <h2 className="font-semibold text-[var(--ink)]">Ask AI</h2>
          </div>
          <button onClick={onClose} className="text-[var(--ink-3)] hover:text-[var(--ink)] p-1">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="space-y-2">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  ask();
                }
              }}
              placeholder={
                "Examples:\n• Eric flies out of LAX at 4pm Wednesday. Which ferry should he take?\n• Suggest waypoints for the Two Harbors → Parsons Landing hike on day 3.\n• What if we shift the trip earlier by a week — does ferry availability work?"
              }
              rows={5}
              className="w-full text-sm bg-[var(--paper-2)] rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none border border-[var(--paper-3)]"
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--ink-3)]">⌘/Ctrl+Enter to ask</span>
              <button
                onClick={ask}
                disabled={!question.trim() || loading}
                className="flex items-center gap-1.5 text-sm bg-[var(--accent)] text-white px-4 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-40"
              >
                <Send size={13} />
                {loading ? "Thinking…" : "Ask"}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 whitespace-pre-wrap">{error}</p>
          )}

          {response && (
            <div className="space-y-3">
              {/* Answer */}
              <div className="bg-[var(--paper-2)] rounded-lg px-4 py-3 border border-[var(--paper-3)]">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)] mb-1">
                  Answer
                </p>
                <p className="text-sm text-[var(--ink)] whitespace-pre-wrap leading-relaxed">
                  {response.answer}
                </p>
              </div>

              {/* Suggestions */}
              {response.suggestions.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">
                    Proposed actions ({response.suggestions.length})
                  </p>
                  {response.suggestions.map((s, i) => {
                    if (dismissed.has(i)) return null;
                    const isAdded = added.has(i);

                    if (s.kind === "block") {
                      const edited = editedBlocks[i] ?? s.block;
                      return (
                        <div
                          key={i}
                          className={`bg-white rounded-lg p-3 border ${
                            isAdded
                              ? "border-green-300 bg-green-50"
                              : "border-[var(--paper-3)]"
                          } space-y-2`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <span className="text-lg">{edited.icon}</span>
                              <input
                                value={edited.title}
                                onChange={(e) => updateBlock(i, { title: e.target.value })}
                                disabled={isAdded}
                                className="font-semibold text-sm bg-[var(--paper-2)] border border-[var(--paper-3)] rounded px-2 py-1 outline-none focus:ring-1 focus:ring-[var(--accent)] flex-1 min-w-[140px]"
                              />
                              <span className="text-xs bg-[var(--paper-3)] px-2 py-0.5 rounded-full capitalize">
                                {edited.type}
                              </span>
                            </div>
                          </div>

                          {edited.subtitle && (
                            <p className="text-xs text-[var(--ink-3)]">{edited.subtitle}</p>
                          )}

                          {s.reason && (
                            <p className="text-xs italic text-[var(--ink-2)]">
                              <Sparkles size={9} className="inline mr-1 text-[var(--accent)]" />
                              {s.reason}
                            </p>
                          )}

                          {(edited.from_location || edited.to_location) && (
                            <p className="text-xs text-[var(--ink-2)]">
                              {edited.from_location} → {edited.to_location}
                              {edited.distance_mi && ` · ${edited.distance_mi} mi`}
                              {edited.duration_min && ` · ${Math.floor(edited.duration_min / 60)}h ${edited.duration_min % 60}m`}
                            </p>
                          )}

                          {!isAdded && (
                            <>
                              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[var(--paper-2)]">
                                <label className="flex items-center gap-1.5">
                                  <span className="text-[10px] uppercase text-[var(--ink-3)] font-medium">
                                    Date
                                  </span>
                                  <input
                                    type="date"
                                    value={edited.date ?? ""}
                                    onChange={(e) => {
                                      const v = e.target.value || null;
                                      updateBlock(i, {
                                        date: v,
                                        day_label: v ? dateToLabel(v) : edited.day_label,
                                      });
                                    }}
                                    className={fieldCls}
                                  />
                                </label>
                                <label className="flex items-center gap-1.5">
                                  <span className="text-[10px] uppercase text-[var(--ink-3)] font-medium">
                                    Status
                                  </span>
                                  <select
                                    value={edited.status}
                                    onChange={(e) =>
                                      updateBlock(i, { status: e.target.value as BlockStatus })
                                    }
                                    className={fieldCls}
                                  >
                                    <option value="idea">idea</option>
                                    <option value="suggested">suggested</option>
                                    <option value="confirmed">confirmed</option>
                                  </select>
                                </label>
                              </div>

                              {dateChips.length > 0 && (
                                <div className="flex flex-wrap gap-1 items-center">
                                  <span className="text-[10px] text-[var(--ink-3)] mr-1">Quick:</span>
                                  {dateChips.map((d) => (
                                    <button
                                      key={d.date}
                                      type="button"
                                      onClick={() =>
                                        updateBlock(i, {
                                          date: d.date,
                                          day_label: d.day_label ?? dateToLabel(d.date),
                                        })
                                      }
                                      className={`text-[10px] px-2 py-0.5 rounded-full transition ${
                                        edited.date === d.date
                                          ? "bg-[var(--ink)] text-white"
                                          : "bg-[var(--paper-2)] text-[var(--ink-3)] hover:bg-[var(--paper-3)]"
                                      }`}
                                    >
                                      {d.day_label ?? dateToLabel(d.date)}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </>
                          )}

                          <div className="flex items-center gap-2 pt-1">
                            {isAdded ? (
                              <span className="flex items-center gap-1 text-xs text-green-700 font-medium">
                                <Check size={11} /> Added
                              </span>
                            ) : (
                              <>
                                <button
                                  onClick={() => addBlock(i)}
                                  className="flex items-center gap-1 text-xs bg-[var(--green)] text-white px-3 py-1 rounded-lg hover:opacity-90"
                                >
                                  <Plus size={11} />
                                  Add to plan
                                </button>
                                <button
                                  onClick={() => setDismissed((prev) => new Set(prev).add(i))}
                                  className="text-xs text-[var(--ink-3)] hover:text-[var(--ink)] px-2 py-1"
                                >
                                  Dismiss
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    }

                    // Waypoints suggestion
                    return (
                      <div
                        key={i}
                        className={`bg-white rounded-lg p-3 border ${
                          isAdded
                            ? "border-green-300 bg-green-50"
                            : "border-[var(--paper-3)]"
                        } space-y-2`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🥾</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-[var(--ink)]">
                              {s.waypoints.length} waypoints for{" "}
                              <span className="font-normal italic">
                                {s.target_block_title}
                              </span>
                            </p>
                          </div>
                        </div>
                        {s.reason && (
                          <p className="text-xs italic text-[var(--ink-2)]">
                            <Sparkles size={9} className="inline mr-1 text-[var(--accent)]" />
                            {s.reason}
                          </p>
                        )}
                        <div className="bg-[var(--paper-2)] rounded-lg p-2 border border-[var(--paper-3)] max-h-64 overflow-y-auto">
                          <WaypointTable waypoints={s.waypoints} />
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          {isAdded ? (
                            <span className="flex items-center gap-1 text-xs text-green-700 font-medium">
                              <Check size={11} /> Added
                            </span>
                          ) : (
                            <>
                              <button
                                onClick={() => addWaypoints(i, s)}
                                className="flex items-center gap-1 text-xs bg-[var(--green)] text-white px-3 py-1 rounded-lg hover:opacity-90"
                              >
                                <Plus size={11} />
                                Append to hike
                              </button>
                              <button
                                onClick={() => setDismissed((prev) => new Set(prev).add(i))}
                                className="text-xs text-[var(--ink-3)] hover:text-[var(--ink)] px-2 py-1"
                              >
                                Dismiss
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {response.suggestions.length === 0 && (
                <p className="text-xs text-[var(--ink-3)] italic">
                  No concrete actions proposed — just the answer above.
                </p>
              )}

              <button
                onClick={() => {
                  setResponse(null);
                  setQuestion("");
                  setDismissed(new Set());
                  setAdded(new Set());
                }}
                className="text-xs text-[var(--ink-3)] hover:text-[var(--ink)]"
              >
                ← Ask another question
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof window === "undefined") return null;
  return createPortal(modal, document.body);
}
