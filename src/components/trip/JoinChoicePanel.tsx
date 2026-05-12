"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Participant } from "@/lib/types";
import { suggestClaimMatches } from "@/lib/invite-match";
import Avatar from "@/components/ui/Avatar";

interface JoinChoicePanelProps {
  tripId: string;
  tripName: string;
  token: string;
  participants: Participant[];
  initialUserId: string | null;
  initialEmail: string | null;
  initialFullName: string | null;
}

type Mode = "claim" | "joinAsNew" | null;

const dismissedKey = (tripId: string) => `waypoint.join.dismissed.${tripId}`;

export default function JoinChoicePanel({
  tripId,
  tripName,
  token,
  participants,
  initialUserId,
  initialEmail,
  initialFullName,
}: JoinChoicePanelProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState(initialFullName ?? initialEmail ?? "");

  const userId = initialUserId;
  const isMember = useMemo(
    () => !!userId && participants.some((p) => p.user_id === userId),
    [userId, participants]
  );
  const unclaimed = useMemo(() => participants.filter((p) => p.user_id === null), [participants]);
  const suggestions = useMemo(
    () => suggestClaimMatches({ email: initialEmail, fullName: initialFullName }, unclaimed),
    [initialEmail, initialFullName, unclaimed]
  );

  // Auto-open on first visit unless dismissed.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isMember) {
      setOpen(true);
      return;
    }
    const dismissed = window.localStorage.getItem(dismissedKey(tripId)) === "1";
    if (!dismissed) setOpen(true);
  }, [tripId, isMember]);

  async function signInWithGoogle() {
    setBusy(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=/trips/${tripId}/join/${token}`,
      },
    });
  }

  async function claim(participantId: string) {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("claim_participant_by_token", {
      p_participant_id: participantId,
      p_trip_id: tripId,
      p_token: token,
    });
    if (rpcError) {
      setError(rpcError.message);
      setBusy(false);
      return;
    }
    router.push(`/trips/${tripId}`);
  }

  async function joinAsNew() {
    const name = newName.trim();
    if (!name) {
      setError("Please enter a name.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("join_trip_by_token", {
      p_trip_id: tripId,
      p_token: token,
      p_name: name,
    });
    if (rpcError) {
      setError(rpcError.message);
      setBusy(false);
      return;
    }
    router.push(`/trips/${tripId}`);
  }

  function justView() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(dismissedKey(tripId), "1");
    }
    setOpen(false);
    setMode(null);
  }

  function reopen() {
    setOpen(true);
    setMode(null);
    setError(null);
  }

  if (!open) {
    return (
      <button
        onClick={reopen}
        className="fixed bottom-6 right-6 bg-[var(--accent)] text-white px-4 py-3 rounded-full shadow-lg hover:opacity-90 text-sm font-medium z-40"
      >
        Join this trip
      </button>
    );
  }

  // Already a member — collapse to a single open-trip CTA.
  if (isMember) {
    return (
      <Overlay onClose={() => setOpen(false)}>
        <h2 className="font-serif text-xl font-bold text-[var(--ink)]">You&rsquo;re in {tripName}.</h2>
        <button
          onClick={() => router.push(`/trips/${tripId}`)}
          className="w-full mt-4 bg-[var(--accent)] text-white py-3 rounded-xl font-medium hover:opacity-90 transition"
        >
          Open trip
        </button>
      </Overlay>
    );
  }

  // Signed out — Google + just-view.
  if (!userId) {
    return (
      <Overlay onClose={justView}>
        <p className="text-sm text-[var(--ink-3)] mb-1">You&rsquo;re invited to</p>
        <h2 className="font-serif text-2xl font-bold text-[var(--ink)] mb-4">{tripName}</h2>
        <button
          onClick={signInWithGoogle}
          disabled={busy}
          className="w-full bg-[var(--accent)] text-white py-3 rounded-xl font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          {busy ? "Opening Google…" : "Sign in with Google to participate"}
        </button>
        <button
          onClick={justView}
          className="w-full text-sm text-[var(--ink-3)] mt-3 hover:text-[var(--ink-2)]"
        >
          Just browse the trip →
        </button>
      </Overlay>
    );
  }

  // Signed in but not a member — claim / join / just view.
  return (
    <Overlay onClose={justView}>
      <p className="text-sm text-[var(--ink-3)] mb-1">You&rsquo;re invited to</p>
      <h2 className="font-serif text-2xl font-bold text-[var(--ink)] mb-4">{tripName}</h2>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
          {error}
        </p>
      )}

      {mode === null && suggestions.length === 1 && (
        <div className="bg-[var(--paper-2)] border border-[var(--paper-3)] rounded-xl p-4 mb-4">
          <p className="text-xs text-[var(--ink-3)] mb-2">We think this might be you</p>
          <div className="flex items-center gap-2 mb-3">
            <Avatar
              name={suggestions[0].participant.name}
              color={suggestions[0].participant.color}
              size="md"
            />
            <span className="font-medium text-[var(--ink)]">
              {suggestions[0].participant.name ?? "Unnamed"}
            </span>
          </div>
          <button
            onClick={() => claim(suggestions[0].participant.id)}
            disabled={busy}
            className="w-full bg-[var(--accent)] text-white py-2.5 rounded-xl font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {busy ? "Claiming…" : `Yes, I'm ${suggestions[0].participant.name ?? "this person"}`}
          </button>
          <button
            onClick={() => setMode("claim")}
            className="w-full text-sm text-[var(--ink-3)] mt-2 hover:text-[var(--ink-2)]"
          >
            Not me →
          </button>
        </div>
      )}

      {mode === null && suggestions.length !== 1 && (
        <div className="space-y-2">
          {unclaimed.length > 0 && (
            <button
              onClick={() => setMode("claim")}
              disabled={busy}
              className="w-full bg-[var(--accent)] text-white py-3 rounded-xl font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              Claim an existing spot
            </button>
          )}
          <button
            onClick={() => setMode("joinAsNew")}
            disabled={busy}
            className="w-full bg-[var(--paper-2)] hover:bg-[var(--paper-3)] text-[var(--ink)] py-3 rounded-xl font-medium transition disabled:opacity-50"
          >
            Join as a new member
          </button>
          <button
            onClick={justView}
            className="w-full text-sm text-[var(--ink-3)] mt-2 hover:text-[var(--ink-2)] py-1"
          >
            Just view for now →
          </button>
        </div>
      )}

      {mode === "claim" && (
        <div>
          <p className="text-xs text-[var(--ink-3)] mb-3">
            {suggestions.length > 1 ? "Possibly you:" : "Pick your spot:"}
          </p>
          <ul className="space-y-2 max-h-72 overflow-y-auto">
            {(suggestions.length > 1 ? suggestions.map((s) => s.participant) : []).map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => claim(p.id)}
                  disabled={busy}
                  className="w-full flex items-center gap-3 p-2 border-2 border-[var(--accent)] rounded-xl hover:bg-[var(--paper-2)] transition disabled:opacity-50"
                >
                  <Avatar name={p.name} color={p.color} size="sm" />
                  <span className="text-sm text-[var(--ink)]">{p.name ?? "Unnamed"}</span>
                  <span className="ml-auto text-xs text-[var(--ink-3)]">likely match</span>
                </button>
              </li>
            ))}
            {unclaimed
              .filter((p) => !suggestions.some((s) => s.participant.id === p.id) || suggestions.length <= 1)
              .map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => claim(p.id)}
                    disabled={busy}
                    className="w-full flex items-center gap-3 p-2 border border-[var(--paper-3)] rounded-xl hover:bg-[var(--paper-2)] transition disabled:opacity-50"
                  >
                    <Avatar name={p.name} color={p.color} size="sm" />
                    <span className="text-sm text-[var(--ink)]">{p.name ?? "Unnamed"}</span>
                  </button>
                </li>
              ))}
          </ul>
          <button
            onClick={() => setMode(null)}
            className="w-full text-sm text-[var(--ink-3)] mt-3 hover:text-[var(--ink-2)]"
          >
            ← Back
          </button>
        </div>
      )}

      {mode === "joinAsNew" && (
        <div>
          <label className="block text-xs text-[var(--ink-3)] mb-1">Your name on this trip</label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Alex"
            className="w-full border border-[var(--paper-3)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
          />
          <button
            onClick={joinAsNew}
            disabled={busy}
            className="w-full mt-3 bg-[var(--accent)] text-white py-3 rounded-xl font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {busy ? "Joining…" : "Join trip"}
          </button>
          <button
            onClick={() => setMode(null)}
            className="w-full text-sm text-[var(--ink-3)] mt-2 hover:text-[var(--ink-2)]"
          >
            ← Back
          </button>
        </div>
      )}
    </Overlay>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full relative">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 text-[var(--ink-3)] hover:text-[var(--ink)] text-xl leading-none w-7 h-7 flex items-center justify-center"
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}
