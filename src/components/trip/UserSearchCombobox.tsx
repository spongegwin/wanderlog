"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/ui/Avatar";
import { UserPlus, Mail, Loader2 } from "lucide-react";

interface CotripperHit {
  user_id: string;
  name: string;
  email: string | null;
  trips_shared: number;
}

interface EmailHit {
  user_id: string;
  name: string;
}

export type InviteAction =
  | { kind: "invitePending"; email: string; name: string }
  | { kind: "addUnclaimed"; name: string };

interface UserSearchComboboxProps {
  onPick: (action: InviteAction) => Promise<void>;
  excludeUserIds?: Set<string>;
  excludeEmails?: Set<string>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputCls =
  "w-full border border-[var(--paper-3)] rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)] bg-white";

export default function UserSearchCombobox({
  onPick,
  excludeUserIds,
  excludeEmails,
}: UserSearchComboboxProps) {
  const supabase = createClient();
  const [text, setText] = useState("");
  const [hits, setHits] = useState<CotripperHit[]>([]);
  const [emailHit, setEmailHit] = useState<EmailHit | null>(null);
  const [emailChecked, setEmailChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const looksLikeEmail = EMAIL_RE.test(text.trim());

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = text.trim();
    if (!q) {
      setHits([]);
      setEmailHit(null);
      setEmailChecked(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      if (EMAIL_RE.test(q)) {
        const { data } = await supabase.rpc("find_user_by_email", { p_email: q });
        const row = (data?.[0] ?? null) as EmailHit | null;
        const exclude =
          row != null &&
          ((excludeUserIds?.has(row.user_id) ?? false) ||
            (excludeEmails?.has(q.toLowerCase()) ?? false));
        setEmailHit(exclude ? null : row);
        setEmailChecked(true);
        setHits([]);
      } else {
        const { data } = await supabase.rpc("find_past_cotrippers", { p_query: q });
        const rows = ((data ?? []) as CotripperHit[]).filter(
          (h) =>
            !(excludeUserIds?.has(h.user_id) ?? false) &&
            !(h.email && (excludeEmails?.has(h.email.toLowerCase()) ?? false))
        );
        setHits(rows);
        setEmailHit(null);
        setEmailChecked(false);
      }
      setLoading(false);
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [text, supabase, excludeUserIds, excludeEmails]);

  async function pick(action: InviteAction) {
    setBusy(true);
    setError(null);
    try {
      await onPick(action);
      setText("");
      setHits([]);
      setEmailHit(null);
      setEmailChecked(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Search past co-trippers or enter an email…"
        className={inputCls}
        disabled={busy}
      />

      {text.trim() && (
        <div className="mt-1 border border-[var(--paper-3)] rounded-lg bg-white shadow-sm overflow-hidden">
          {loading && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--ink-3)]">
              <Loader2 size={12} className="animate-spin" />
              Searching…
            </div>
          )}

          {!loading && !looksLikeEmail && hits.length === 0 && (
            <button
              onClick={() => pick({ kind: "addUnclaimed", name: text.trim() })}
              disabled={busy}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--paper-2)] disabled:opacity-50 text-left"
            >
              <UserPlus size={14} className="text-[var(--accent)]" />
              <span>
                Add &ldquo;<strong>{text.trim()}</strong>&rdquo; as an unclaimed slot
              </span>
            </button>
          )}

          {!loading && !looksLikeEmail && hits.length > 0 && (
            <>
              {hits.map((h) => (
                <button
                  key={h.user_id}
                  onClick={() =>
                    pick({
                      kind: "invitePending",
                      email: h.email ?? "",
                      name: h.name,
                    })
                  }
                  disabled={busy || !h.email}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--paper-2)] disabled:opacity-50 text-left"
                >
                  <Avatar name={h.name} size="sm" />
                  <span className="flex-1 truncate">{h.name}</span>
                  <span className="text-xs text-[var(--ink-3)] flex-shrink-0">
                    {h.trips_shared} trip{h.trips_shared === 1 ? "" : "s"} together
                  </span>
                </button>
              ))}
              <button
                onClick={() => pick({ kind: "addUnclaimed", name: text.trim() })}
                disabled={busy}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-[var(--paper-2)] disabled:opacity-50 text-left border-t border-[var(--paper-3)] text-[var(--ink-3)]"
              >
                <UserPlus size={12} />
                Or add &ldquo;{text.trim()}&rdquo; as an unclaimed slot
              </button>
            </>
          )}

          {!loading && looksLikeEmail && emailHit && (
            <button
              onClick={() =>
                pick({
                  kind: "invitePending",
                  email: text.trim(),
                  name: emailHit.name,
                })
              }
              disabled={busy}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--paper-2)] disabled:opacity-50 text-left"
            >
              <Avatar name={emailHit.name} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="truncate">{emailHit.name}</p>
                <p className="text-xs text-[var(--ink-3)] truncate">{text.trim()}</p>
              </div>
              <span className="text-xs text-[var(--accent)] flex-shrink-0">
                Wingit user
              </span>
            </button>
          )}

          {!loading && looksLikeEmail && !emailHit && emailChecked && (
            <button
              onClick={() =>
                pick({ kind: "invitePending", email: text.trim(), name: text.trim() })
              }
              disabled={busy}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--paper-2)] disabled:opacity-50 text-left"
            >
              <Mail size={14} className="text-[var(--ink-3)]" />
              <span>
                No account for <strong>{text.trim()}</strong> yet — invite anyway
              </span>
            </button>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
