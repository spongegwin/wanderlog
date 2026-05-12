"use client";

import { useEffect, useState } from "react";
import type { Resource, Participant } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity";
import { detectLink } from "@/lib/link-detect";
import { Plus, ExternalLink, Trash2 } from "lucide-react";

interface GroupLinksProps {
  tripId: string;
  participants: Participant[];
  currentUserId: string | null;
  currentUserName: string | null;
}

export default function GroupLinks({
  tripId,
  currentUserId,
  currentUserName,
}: GroupLinksProps) {
  const [links, setLinks] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const supabase = createClient();

  async function fetchLinks() {
    const { data } = await supabase
      .from("resources")
      .select("*")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: true });
    setLinks((data ?? []) as Resource[]);
    setLoading(false);
  }

  useEffect(() => {
    fetchLinks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  async function addLink() {
    const trimmed = url.trim();
    if (!trimmed) return;
    setAdding(true);
    const detected = detectLink(trimmed);
    const displayTitle = title.trim() || detected.label;
    const normalizedUrl = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
    const { data } = await supabase
      .from("resources")
      .insert({
        trip_id: tripId,
        category: "other",
        title: displayTitle,
        url: normalizedUrl,
        added_by: currentUserId,
      } as Record<string, unknown>)
      .select()
      .single();
    if (data) {
      setLinks((prev) => [...prev, data as Resource]);
      setUrl("");
      setTitle("");
      if (currentUserId) {
        await logActivity(supabase, {
          tripId,
          userId: currentUserId,
          actorName: currentUserName,
          action: "resource.added",
          targetId: (data as Resource).id,
          summary: `added link to ${detected.label} (${displayTitle})`,
        });
      }
    }
    setAdding(false);
  }

  async function removeLink(link: Resource) {
    setLinks((prev) => prev.filter((l) => l.id !== link.id));
    await supabase.from("resources").delete().eq("id", link.id);
    if (currentUserId) {
      await logActivity(supabase, {
        tripId,
        userId: currentUserId,
        actorName: currentUserName,
        action: "resource.removed",
        targetId: link.id,
        summary: `removed link ${link.title ?? link.url}`,
      });
    }
  }

  return (
    <section className="bg-white border border-[var(--paper-3)] rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[var(--paper-3)] flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--ink)]">Group links</h3>
          <p className="text-xs text-[var(--ink-3)]">
            Quick access to the team&apos;s WhatsApp, Splitwise, Tricount, docs, anything.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--ink-3)] text-center py-6">Loading…</p>
      ) : links.length === 0 ? (
        <p className="text-xs text-[var(--ink-3)] text-center py-4 italic">
          No links yet. Paste one below.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--paper-2)]">
          {links.map((link) => {
            const detected = detectLink(link.url);
            const display = link.title || detected.label;
            return (
              <li
                key={link.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--paper-2)] transition-colors group"
              >
                <span className="text-lg flex-shrink-0">{detected.icon}</span>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-0 flex items-center gap-1.5 text-sm text-[var(--ink)] hover:text-[var(--accent)] transition truncate"
                >
                  <span className="font-medium truncate">{display}</span>
                  <span className="text-xs text-[var(--ink-3)] truncate">
                    · {detected.hostname}
                  </span>
                  <ExternalLink size={11} className="text-[var(--ink-3)] flex-shrink-0" />
                </a>
                {currentUserId && (
                  <button
                    onClick={() => removeLink(link)}
                    className="text-[var(--ink-3)] hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition"
                    title="Remove link"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {currentUserId && (
        <div className="border-t border-[var(--paper-3)] bg-[var(--paper-2)] px-3 py-2 space-y-2">
          <div className="flex items-center gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addLink()}
              placeholder="Paste a link — Splitwise, WhatsApp, Google Doc…"
              className="flex-1 text-sm bg-white border border-[var(--paper-3)] rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addLink()}
              placeholder="Title (optional)"
              className="w-32 text-sm bg-white border border-[var(--paper-3)] rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-[var(--accent)] hidden sm:block"
            />
            <button
              onClick={addLink}
              disabled={!url.trim() || adding}
              className="flex items-center gap-1 text-sm bg-[var(--accent)] text-white px-3 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-40 flex-shrink-0"
            >
              <Plus size={13} />
              Add
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
