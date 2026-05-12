"use client";

import { useEffect, useState } from "react";
import type { ParsedHike, Confidence } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity";
import { Sparkles, Plus } from "lucide-react";

interface AddHikeBlockProps {
  tripId: string;
  currentUserId: string;
  currentUserName: string | null;
  onAdded: () => void;
}

type Mode = "paste" | "manual";

const confidenceStyle: Record<Confidence, string> = {
  found: "border-emerald-400 bg-emerald-50",
  inferred: "border-amber-400 bg-amber-50",
  missing: "border-[var(--paper-3)] bg-[var(--paper-2)]",
};

const confidenceBadge: Record<Confidence, string> = {
  found: "bg-emerald-100 text-emerald-800",
  inferred: "bg-amber-100 text-amber-800",
  missing: "bg-[var(--paper-3)] text-[var(--ink-3)]",
};

function dateToLabel(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric",
  });
}

export default function AddHikeBlock({
  tripId,
  currentUserId,
  currentUserName,
  onAdded,
}: AddHikeBlockProps) {
  const [mode, setMode] = useState<Mode>("paste");
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedHike | null>(null);
  const [form, setForm] = useState<Partial<ParsedHike>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dateChips, setDateChips] = useState<{ date: string; day_label: string | null }[]>([]);
  const supabase = createClient();

  useEffect(() => {
    supabase
      .from("itinerary_blocks")
      .select("date, day_label")
      .eq("trip_id", tripId)
      .then(({ data }) => {
        const seen = new Set<string>();
        const out: { date: string; day_label: string | null }[] = [];
        for (const b of (data ?? []) as { date: string | null; day_label: string | null }[]) {
          if (b.date && !seen.has(b.date)) {
            seen.add(b.date);
            out.push({ date: b.date, day_label: b.day_label });
          }
        }
        out.sort((a, b) => a.date.localeCompare(b.date));
        setDateChips(out);
      });
  }, [tripId]);

  async function parse() {
    if (!text.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/parse-hike", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, tripId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setParsed(data);
      setForm(data);
    } catch {
      setError("Couldn't parse — try again.");
    } finally {
      setLoading(false);
    }
  }

  async function addHike() {
    const data = form;
    await supabase.from("itinerary_blocks").insert({
      trip_id: tripId,
      type: "hike",
      icon: "🥾",
      title: data.name ?? "Hike",
      subtitle: data.notes ?? null,
      status: "idea",
      day_label: data.day_label ?? null,
      date: data.date ?? null,
      hike_start: data.start_point ?? null,
      hike_end: data.end_point ?? null,
      hike_distance: data.distance ?? null,
      hike_elev_gain: data.elevation_gain ?? null,
      hike_est_hours: data.est_hours ?? null,
      hike_difficulty: data.difficulty ?? null,
      hike_has_variant: data.has_variant ?? false,
      hike_variant_note: data.variant_note ?? null,
      added_by: currentUserId,
    } as Record<string, unknown>);
    await logActivity(supabase, {
      tripId,
      userId: currentUserId,
      actorName: currentUserName,
      action: "block.created",
      summary: `added hike ${data.name ?? "Hike"}`,
    });
    setParsed(null);
    setForm({});
    setText("");
    onAdded();
  }

  function fieldClass(key: keyof ParsedHike["confidence"]): string {
    if (!parsed) return "border-[var(--paper-3)] bg-[var(--paper-2)]";
    return confidenceStyle[parsed.confidence[key]];
  }

  function badgeClass(key: keyof ParsedHike["confidence"]): string {
    if (!parsed) return "";
    return confidenceBadge[parsed.confidence[key]];
  }

  return (
    <div className="bg-white border border-dashed border-[var(--paper-3)] rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[var(--ink-2)]">Add hike stage</p>
        <div className="flex text-xs rounded-lg overflow-hidden border border-[var(--paper-3)]">
          {(["paste", "manual"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 capitalize transition ${
                mode === m ? "bg-[var(--paper-3)] text-[var(--ink)]" : "text-[var(--ink-3)]"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {mode === "paste" && (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste trail description, AllTrails page, spreadsheet row…"
            rows={3}
            className="w-full text-sm bg-[var(--paper-2)] rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            onClick={parse}
            disabled={loading || !text.trim()}
            className="flex items-center gap-1.5 text-sm bg-[var(--accent)] text-white px-3 py-1.5 rounded-lg disabled:opacity-50 hover:opacity-90 transition"
          >
            <Sparkles size={14} />
            {loading ? "Parsing…" : "Parse with AI"}
          </button>
        </>
      )}

      {(parsed || mode === "manual") && (
        <>
          {parsed && (
            <p className="text-xs text-[var(--ink-3)] flex items-center gap-1.5">
              <Sparkles size={11} className="text-[var(--accent)]" />
              AI suggested the details below — review & edit before adding.
            </p>
          )}

          {/* Date row — sits on top because it's the most editable thing */}
          <div className="bg-[var(--paper-2)] rounded-lg p-3 space-y-2 border border-[var(--paper-3)]">
            <div className="flex items-center justify-between mb-0.5">
              <label className="text-xs text-[var(--ink-3)] font-medium uppercase tracking-wide">
                Date
              </label>
              {parsed && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${badgeClass("date")}`}>
                  {parsed.confidence.date}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="date"
                value={form.date ?? ""}
                onChange={(e) => {
                  const v = e.target.value || null;
                  setForm((f) => ({
                    ...f,
                    date: v,
                    day_label: v ? dateToLabel(v) : f.day_label,
                  }));
                }}
                className={`text-sm rounded-lg px-3 py-1.5 border outline-none focus:ring-1 focus:ring-[var(--accent)] ${fieldClass("date")}`}
              />
              <input
                value={form.day_label ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, day_label: e.target.value || null }))}
                placeholder="Label (e.g. Day 2)"
                className={`text-sm rounded-lg px-3 py-1.5 border outline-none focus:ring-1 focus:ring-[var(--accent)] flex-1 min-w-[140px] ${fieldClass("day_label")}`}
              />
            </div>
            {dateChips.length > 0 && (
              <div className="flex flex-wrap gap-1 items-center">
                <span className="text-[10px] text-[var(--ink-3)] mr-1">Quick:</span>
                {dateChips.map((d) => (
                  <button
                    key={d.date}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        date: d.date,
                        day_label: d.day_label ?? dateToLabel(d.date),
                      }))
                    }
                    className={`text-[10px] px-2 py-0.5 rounded-full transition ${
                      form.date === d.date
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

          <div className="space-y-2">
            {([
              ["name", "Hike name", "name"],
              ["start_point", "Start point", "start_point"],
              ["end_point", "End point", "end_point"],
              ["distance", "Distance", "distance"],
              ["elevation_gain", "Elevation gain", "elevation_gain"],
              ["est_hours", "Est. hours", "est_hours"],
            ] as [keyof ParsedHike, string, keyof ParsedHike["confidence"]][]).map(
              ([field, label, confKey]) => (
                <div key={field}>
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="text-xs text-[var(--ink-3)]">{label}</label>
                    {parsed && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${badgeClass(confKey)}`}>
                        {parsed.confidence[confKey]}
                      </span>
                    )}
                  </div>
                  <input
                    value={(form[field] as string) ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                    className={`w-full text-sm rounded-lg px-3 py-1.5 border outline-none focus:ring-1 focus:ring-[var(--accent)] ${fieldClass(confKey)}`}
                  />
                </div>
              )
            )}
          </div>
        </>
      )}

      {(parsed || mode === "manual") && (
        <button
          onClick={addHike}
          className="flex items-center gap-1.5 text-sm bg-[var(--green)] text-white px-3 py-1.5 rounded-lg hover:opacity-90 transition"
        >
          <Plus size={14} />
          Add to plan
        </button>
      )}
    </div>
  );
}
