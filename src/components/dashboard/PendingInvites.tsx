"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Check, X, MapPin } from "lucide-react";

interface PendingInviteRow {
  participant_id: string;
  trip_id: string;
  trip_name: string;
  trip_destination: string | null;
  invited_email: string;
  name: string | null;
}

const dismissedKey = (participantId: string) =>
  `wingit.dismissed-invite.${participantId}`;

export default function PendingInvites() {
  const router = useRouter();
  const supabase = createClient();
  const [rows, setRows] = useState<PendingInviteRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc("list_pending_invites_for_me");
      if (cancelled) return;
      const all = (data ?? []) as PendingInviteRow[];
      const visible = all.filter((r) => {
        if (typeof window === "undefined") return true;
        return window.localStorage.getItem(dismissedKey(r.participant_id)) !== "1";
      });
      setRows(visible);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function accept(row: PendingInviteRow) {
    setBusyId(row.participant_id);
    setError(null);
    const { error: rpcError } = await supabase.rpc("accept_pending_invite", {
      p_participant_id: row.participant_id,
    });
    if (rpcError) {
      setError(rpcError.message);
      setBusyId(null);
      return;
    }
    router.push(`/trips/${row.trip_id}`);
    router.refresh();
  }

  function dismiss(row: PendingInviteRow) {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(dismissedKey(row.participant_id), "1");
    }
    setRows((prev) => prev.filter((r) => r.participant_id !== row.participant_id));
  }

  if (!loaded || rows.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="font-serif text-sm uppercase tracking-wider text-[var(--ink-3)] mb-3">
        You&rsquo;ve been invited
      </h2>
      {error && (
        <p className="text-xs text-red-600 mb-2">{error}</p>
      )}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li
            key={row.participant_id}
            className="flex items-center gap-3 bg-white border border-[var(--paper-3)] rounded-xl px-4 py-3"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--ink)] truncate">
                {row.trip_name}
              </p>
              {row.trip_destination && (
                <p className="text-xs text-[var(--ink-3)] flex items-center gap-1 mt-0.5 truncate">
                  <MapPin size={11} />
                  {row.trip_destination}
                </p>
              )}
            </div>
            <button
              onClick={() => accept(row)}
              disabled={busyId === row.participant_id}
              className="flex items-center gap-1 text-xs bg-[var(--accent)] text-white px-3 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              <Check size={12} />
              {busyId === row.participant_id ? "Accepting…" : "Accept"}
            </button>
            <button
              onClick={() => dismiss(row)}
              disabled={busyId === row.participant_id}
              className="text-[var(--ink-3)] hover:text-[var(--ink)] p-1.5 disabled:opacity-50"
              title="Dismiss"
            >
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
