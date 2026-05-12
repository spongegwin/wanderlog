"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, Link as LinkIcon, FileText, ListChecks, X } from "lucide-react";

type Tab = "paste" | "text" | "url";

export interface ImportedItem {
  label: string;
  category: string;
  scope?: "shared" | "personal";
}

interface PackingImporterProps {
  existingCount: number;
  onImport: (items: ImportedItem[], mode: "append" | "replace") => void;
  onCancel: () => void;
}

const VALID_CATEGORIES = ["Gear", "Clothing", "Food", "Documents", "Other"];

function parsePastedList(raw: string): ImportedItem[] {
  const items: ImportedItem[] = [];
  let currentCategory = "Other";
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Detect category header like "Gear:" or "## Clothing"
    const headerMatch = trimmed.match(/^#*\s*(Gear|Clothing|Food|Documents|Other)\s*:?\s*$/i);
    if (headerMatch) {
      const cat = headerMatch[1];
      currentCategory =
        VALID_CATEGORIES.find((c) => c.toLowerCase() === cat.toLowerCase()) ?? "Other";
      continue;
    }
    // Inline category prefix: "Gear: Headlamp"
    const inline = trimmed.match(/^(Gear|Clothing|Food|Documents|Other)\s*[:|-]\s*(.+)$/i);
    if (inline) {
      const cat =
        VALID_CATEGORIES.find((c) => c.toLowerCase() === inline[1].toLowerCase()) ?? "Other";
      items.push({ label: inline[2].trim(), category: cat });
      continue;
    }
    // Strip leading bullets/numbers
    const label = trimmed.replace(/^[-*•·\d.)\s]+/, "").trim();
    if (label) items.push({ label, category: currentCategory });
  }
  return items;
}

export default function PackingImporter({
  existingCount,
  onImport,
  onCancel,
}: PackingImporterProps) {
  const [tab, setTab] = useState<Tab>("paste");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<ImportedItem[] | null>(null);
  const [sourceTitle, setSourceTitle] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handlePaste(raw: string) {
    setText(raw);
    const parsed = parsePastedList(raw);
    setPreview(parsed.length ? parsed : null);
    setError(parsed.length ? "" : "");
  }

  async function parseWithAI(body: { text?: string; url?: string }) {
    setLoading(true);
    setError("");
    setPreview(null);
    setSourceTitle(undefined);
    try {
      const res = await fetch("/api/parse-packing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPreview(data.items?.length ? data.items : null);
      setSourceTitle(data.source_title);
      if (!data.items?.length) setError("No items found — try pasting the list directly.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to parse.");
    } finally {
      setLoading(false);
    }
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "paste", label: "Paste list", icon: <ListChecks size={13} /> },
    { id: "text", label: "AI text", icon: <FileText size={13} /> },
    { id: "url", label: "AI URL", icon: <LinkIcon size={13} /> },
  ];

  const modal = (
    <div
      className="fixed inset-0 z-[100] bg-black/30 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-[var(--paper-3)] px-5 py-3 flex items-center justify-between z-10">
          <h2 className="font-semibold text-[var(--ink)]">Import packing items</h2>
          <button onClick={onCancel} className="text-[var(--ink-3)] hover:text-[var(--ink)] p-1">
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-1 px-4 pt-3">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                setPreview(null);
                setError("");
              }}
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

        <div className="px-5 py-4 space-y-3">
          {tab === "paste" && (
            <>
              <p className="text-xs text-[var(--ink-3)]">
                One item per line. Optional category headers (e.g. <code>Gear:</code>) group items.
              </p>
              <textarea
                value={text}
                onChange={(e) => handlePaste(e.target.value)}
                placeholder={`Gear:\nTent (3p)\nStove + fuel\n\nClothing:\nRain shell\nSocks x3`}
                rows={6}
                className="w-full text-sm bg-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none font-mono border border-[var(--paper-3)]"
              />
            </>
          )}

          {tab === "text" && (
            <>
              <p className="text-xs text-[var(--ink-3)]">
                Paste a gear guide, blog post, or email. AI will categorize.
              </p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste any text describing what to pack…"
                rows={6}
                className="w-full text-sm bg-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none border border-[var(--paper-3)]"
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
                Paste a URL — AI will fetch the page and extract a gear list.
              </p>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.rei.com/learn/expert-advice/backpacking-checklist.html"
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
              <p className="text-xs font-medium text-[var(--ink-2)]">
                {preview.length} items found
                {sourceTitle && ` · ${sourceTitle}`}
              </p>
              <ul className="bg-[var(--paper-2)] rounded-lg p-3 max-h-56 overflow-y-auto space-y-1 text-sm border border-[var(--paper-3)]">
                {preview.map((it, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span>{it.label}</span>
                    <span className="text-[10px] uppercase tracking-wide text-[var(--ink-3)] flex-shrink-0">
                      {it.category}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => onImport(preview, "append")}
                  className="text-sm bg-[var(--green)] text-white px-3 py-1.5 rounded-lg hover:opacity-90"
                >
                  Add {preview.length} {existingCount > 0 ? "to list" : "items"}
                </button>
                {existingCount > 0 && (
                  <button
                    onClick={() => onImport(preview, "replace")}
                    className="text-sm border border-[var(--green)] text-[var(--green)] px-3 py-1.5 rounded-lg hover:bg-green-50"
                  >
                    Replace existing
                  </button>
                )}
                <button
                  onClick={onCancel}
                  className="text-sm text-[var(--ink-3)] px-3 py-1.5 rounded-lg hover:bg-[var(--paper-3)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof window === "undefined") return null;
  return createPortal(modal, document.body);
}
