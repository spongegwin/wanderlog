"use client";

import { useState } from "react";
import type { HikeWaypoint } from "@/lib/types";
import { parseTSV } from "@/lib/waypoints";
import WaypointTable from "./WaypointTable";
import { Sparkles, Link, Table, FileText, X } from "lucide-react";

type Tab = "spreadsheet" | "text" | "url";

interface WaypointImporterProps {
  existingCount: number;
  onImport: (waypoints: HikeWaypoint[], mode: "replace" | "append") => void;
  onCancel: () => void;
}

export default function WaypointImporter({
  existingCount,
  onImport,
  onCancel,
}: WaypointImporterProps) {
  const [tab, setTab] = useState<Tab>("spreadsheet");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<HikeWaypoint[] | null>(null);
  const [sourceTitle, setSourceTitle] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleSpreadsheetPaste(raw: string) {
    setText(raw);
    const parsed = parseTSV(raw);
    setPreview(parsed.length ? parsed : null);
    setError(parsed.length ? "" : "No waypoints found — check the format.");
  }

  async function parseWithAI(body: { text?: string; url?: string }) {
    setLoading(true);
    setError("");
    setPreview(null);
    try {
      const res = await fetch("/api/parse-waypoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPreview(data.waypoints?.length ? data.waypoints : null);
      setSourceTitle(data.source_title);
      if (!data.waypoints?.length) setError("No timetable found — try pasting the text directly.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to parse.");
    } finally {
      setLoading(false);
    }
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "spreadsheet", label: "Spreadsheet", icon: <Table size={13} /> },
    { id: "text", label: "Text", icon: <FileText size={13} /> },
    { id: "url", label: "URL", icon: <Link size={13} /> },
  ];

  return (
    <div className="border border-[var(--paper-3)] rounded-xl overflow-hidden bg-[var(--paper-2)]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--paper-3)] bg-white">
        <span className="text-sm font-semibold">Import waypoints</span>
        <button onClick={onCancel} className="text-[var(--ink-3)] hover:text-[var(--ink)]">
          <X size={16} />
        </button>
      </div>

      <div className="flex gap-1 px-4 pt-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setPreview(null); setError(""); }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition ${
              tab === t.id
                ? "bg-[var(--ink)] text-white"
                : "text-[var(--ink-3)] hover:bg-[var(--paper-3)]"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-3">
        {tab === "spreadsheet" && (
          <>
            <p className="text-xs text-[var(--ink-3)]">
              Paste from Google Sheets. Columns: Location | Elevation | ↑Gain | ↓Loss | mi | Total | Duration | Time | Escape | Notes
            </p>
            <textarea
              value={text}
              onChange={(e) => handleSpreadsheetPaste(e.target.value)}
              placeholder="Paste from Google Sheets here…"
              rows={5}
              className="w-full text-xs bg-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none font-mono border border-[var(--paper-3)]"
            />
          </>
        )}

        {tab === "text" && (
          <>
            <p className="text-xs text-[var(--ink-3)]">
              Paste text from a trail guide, blog post, or email. AI will find the timetable.
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste trail guide text, blog post, booking confirmation…"
              rows={5}
              className="w-full text-xs bg-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none border border-[var(--paper-3)]"
            />
            <button
              onClick={() => parseWithAI({ text })}
              disabled={loading || !text.trim()}
              className="flex items-center gap-1.5 text-sm bg-[var(--accent)] text-white px-3 py-1.5 rounded-lg disabled:opacity-50 hover:opacity-90 transition"
            >
              <Sparkles size={14} />
              {loading ? "Parsing…" : "Parse with AI"}
            </button>
          </>
        )}

        {tab === "url" && (
          <>
            <p className="text-xs text-[var(--ink-3)]">
              Paste a URL to a trail guide or itinerary. AI will fetch and extract the timetable.
            </p>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://hikingguy.com/…"
              className="w-full text-sm bg-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-[var(--accent)] border border-[var(--paper-3)]"
            />
            <button
              onClick={() => parseWithAI({ url })}
              disabled={loading || !url.trim()}
              className="flex items-center gap-1.5 text-sm bg-[var(--accent)] text-white px-3 py-1.5 rounded-lg disabled:opacity-50 hover:opacity-90 transition"
            >
              <Sparkles size={14} />
              {loading ? "Fetching & parsing…" : "Fetch & Parse"}
            </button>
          </>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        {preview && preview.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-[var(--ink-2)]">
                {preview.length} waypoints found
                {sourceTitle && ` · ${sourceTitle}`}
              </p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-[var(--paper-3)]">
              <WaypointTable waypoints={preview} />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => onImport(preview, "replace")}
                className="text-sm bg-[var(--green)] text-white px-3 py-1.5 rounded-lg hover:opacity-90 transition"
              >
                {existingCount > 0 ? "Replace existing" : "Add to block"}
              </button>
              {existingCount > 0 && (
                <button
                  onClick={() => onImport(preview, "append")}
                  className="text-sm border border-[var(--green)] text-[var(--green)] px-3 py-1.5 rounded-lg hover:bg-green-50 transition"
                >
                  Append to existing
                </button>
              )}
              <button
                onClick={onCancel}
                className="text-sm text-[var(--ink-3)] px-3 py-1.5 rounded-lg hover:bg-[var(--paper-3)] transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
