"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Trip } from "@/lib/types";
import { assignColor } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default function JoinPage() {
  const { id, token } = useParams<{ id: string; token: string }>();
  const router = useRouter();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("trips")
      .select("*")
      .eq("id", id)
      .eq("invite_token", token)
      .single()
      .then(({ data }) => {
        setTrip(data);
        setLoading(false);
      });
  }, [id, token]);

  async function join() {
    setJoining(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback?trip_id=${id}`,
        },
      });
      return;
    }

    const { data: existing } = await supabase
      .from("participants")
      .select("id")
      .eq("trip_id", id)
      .eq("user_id", user.id)
      .single();

    if (!existing) {
      const { data: participantCount } = await supabase
        .from("participants")
        .select("id", { count: "exact" })
        .eq("trip_id", id);

      await supabase.from("participants").insert({
        trip_id: id,
        user_id: user.id,
        name: user.user_metadata?.full_name ?? user.email,
        role: "confirmed",
        color: assignColor((participantCount?.length ?? 0)),
      } as Record<string, unknown>);
    }

    router.push(`/trips/${id}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--ink-3)]">Loading…</p>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--ink-3)]">Invite link not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-white border border-[var(--paper-3)] rounded-2xl p-8 max-w-sm w-full text-center shadow-sm">
        <p className="text-sm text-[var(--ink-3)] mb-1">You're invited to</p>
        <h1 className="font-serif text-2xl font-bold text-[var(--ink)] mb-1">{trip.name}</h1>
        {trip.destination && (
          <p className="text-[var(--ink-3)] text-sm mb-1">{trip.destination}</p>
        )}
        {trip.essence && (
          <p className="text-sm italic text-[var(--ink-2)] mt-2 mb-6">"{trip.essence}"</p>
        )}

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <button
          onClick={join}
          disabled={joining}
          className="w-full bg-[var(--accent)] text-white py-3 rounded-xl font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          {joining ? "Joining…" : "Join with Google"}
        </button>
      </div>
    </div>
  );
}
