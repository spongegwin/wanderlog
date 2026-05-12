"use client";

import { useEffect, useMemo, useState } from "react";
import type { ParsedBlock } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity";
import { Sparkles, Plus } from "lucide-react";

interface AddBlockProps {
  tripId: string;
  currentUserId: string;
  currentUserName: string | null;
  onAdded: () => void;
}

function dateToLabel(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function AddBlock({
  tripId,
  currentUserId,
  currentUserName,
  onAdded,
}: AddBlockProps) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [existingDates, setExistingDates] = useState<{ date: string; day_label: string | null }[]>([]);
  const supabase = createClient();

  useEffect(() => {
    supabase
      .from("itinerary_blocks")
      .select("date, day_label")
      .eq("trip_id", tripId)
      .then(({ data }) => {
        const seen = new Set<string>();
        const unique: { date: string; day_label: string | null }[] = [];
        for (const b of (data ?? []) as { date: string | null; day_label: string | null }[]) {
          if (b.date && !seen.has(b.date)) {
            seen.add(b.date);
            unique.push({ date: b.date, day_label: b.day_label });
          }
        }
        unique.sort((a, b) => a.date.localeCompare(b.date));
        setExistingDates(unique);
      });
  }, [tripId]);

  const dateChips = useMemo(() => existingDates, [existingDates]);

  async function parse() {
    if (!text.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/parse-block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, tripId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setParsed(Array.isArray(data) ? data : [data]);
    } catch {
      setError("Couldn't parse — try again or fill in manually.");
    } finally {
      setLoading(false);
    }
  }

  function updateBlock(i: number, patch: Partial<ParsedBlock>) {
    setParsed((prev) => prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  }

  async function addBlocks() {
    if (!parsed.length) return;
    await supabase.from("itinerary_blocks").insert(
      parsed.map(
        (b) =>
          ({ trip_id: tripId, added_by: currentUserId, ...b } as Record<string, unknown>)
      )
    );
    for (const b of parsed) {
      await logActivity(supabase, {
        tripId,
        userId: currentUserId,
        actorName: currentUserName,
        action: "block.created",
        summary: `added ${b.title}`,
      });
    }
    setText("");
    setParsed([]);
    onAdded();
  }

  return (
    <div className="bg-white border border-dashed border-[var(--paper-3)] rounded-xl p-4 space-y-3">
      <p className="text-sm font-medium text-[var(--ink-2)]">Add anything</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste a booking email, trail description, reservation note…"
        rows={3}
        className="w-full text-sm bg-[var(--paper-2)] rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}

      {parsed.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-[var(--ink-3)] flex items-center gap-1.5">
            <Sparkles size={11} className="text-[var(--accent)]" />
            AI suggested the details below — review & edit before adding.
          </p>
          {parsed.map((b, i) => (
            <ReviewCard
              key={i}
              block={b}
              dateChips={dateChips}
              onChange={(patch) => updateBlock(i, patch)}
            />
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={parse}
          disabled={loading || !text.trim()}
          className="flex items-center gap-1.5 text-sm bg-[var(--accent)] text-white px-3 py-1.5 rounded-lg disabled:opacity-50 hover:opacity-90 transition"
        >
          <Sparkles size={14} />
          {loading ? "Parsing…" : "Parse with AI"}
        </button>
        {parsed.length > 0 && (
          <button
            onClick={addBlocks}
            className="flex items-center gap-1.5 text-sm bg-[var(--green)] text-white px-3 py-1.5 rounded-lg hover:opacity-90 transition"
          >
            <Plus size={14} />
            {parsed.length > 1 ? `Add ${parsed.length} blocks` : "Add to plan"}
          </button>
        )}
      </div>
    </div>
  );
}

const fieldCls =
  "text-xs border border-[var(--paper-3)] rounded px-2 py-1 outline-none focus:ring-1 focus:ring-[var(--accent)] bg-white";

function ReviewCard({
  block,
  dateChips,
  onChange,
}: {
  block: ParsedBlock;
  dateChips: { date: string; day_label: string | null }[];
  onChange: (patch: Partial<ParsedBlock>) => void;
}) {
  // Highlight whether AI provided a date (vs. user untouched)
  const aiHadDate = !!block.date;

  return (
    <div className="bg-[var(--paper-2)] rounded-lg p-3 text-sm space-y-2 border border-[var(--paper-3)]">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xl">{block.icon}</span>
        <input
          value={block.title}
          onChange={(e) => onChange({ title: e.target.value })}
          className="flex-1 font-semibold bg-white border border-[var(--paper-3)] rounded px-2 py-1 outline-none focus:ring-1 focus:ring-[var(--accent)] text-sm"
        />
        <span className="text-xs bg-[var(--paper-3)] px-2 py-0.5 rounded-full capitalize">
          {block.type}
        </span>
      </div>

      {block.subtitle && (
        <p className="text-[var(--ink-3)] text-xs">{block.subtitle}</p>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[var(--paper-3)]">
        <label className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-[var(--ink-3)] font-medium">
            Date
          </span>
          <input
            type="date"
            value={block.date ?? ""}
            onChange={(e) => {
              const v = e.target.value || null;
              onChange({
                date: v,
                day_label: v ? dateToLabel(v) : block.day_label,
              });
            }}
            className={fieldCls}
          />
          {aiHadDate && (
            <span className="text-[10px] text-[var(--accent)] italic">AI guessed</span>
          )}
        </label>

        <label className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-[var(--ink-3)] font-medium">
            Label
          </span>
          <input
            value={block.day_label ?? ""}
            onChange={(e) => onChange({ day_label: e.target.value || null })}
            placeholder="optional"
            className={`${fieldCls} w-28`}
          />
        </label>

        <label className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-[var(--ink-3)] font-medium">
            Status
          </span>
          <select
            value={block.status}
            onChange={(e) =>
              onChange({ status: e.target.value as ParsedBlock["status"] })
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
                onChange({ date: d.date, day_label: d.day_label ?? dateToLabel(d.date) })
              }
              className={`text-[10px] px-2 py-0.5 rounded-full transition ${
                block.date === d.date
                  ? "bg-[var(--ink)] text-white"
                  : "bg-white text-[var(--ink-3)] hover:bg-[var(--paper-3)] border border-[var(--paper-3)]"
              }`}
            >
              {d.day_label ?? dateToLabel(d.date)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

