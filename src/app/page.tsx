import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TripGrid from "@/components/trip/TripGrid";
import type { Trip, Participant } from "@/lib/types";
import { Plus } from "lucide-react";

export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: participantRows } = await supabase
    .from("participants")
    .select("trip_id")
    .eq("user_id", user.id);

  const participantTripIds = ((participantRows ?? []) as { trip_id: string }[]).map(
    (p) => p.trip_id
  );

  const { data: tripsRaw } = await supabase
    .from("trips")
    .select("*")
    .or(
      [
        `created_by.eq.${user.id}`,
        participantTripIds.length ? `id.in.(${participantTripIds.join(",")})` : null,
      ]
        .filter(Boolean)
        .join(",")
    )
    .order("created_at", { ascending: false });

  const trips = (tripsRaw ?? []) as Trip[];
  const tripIds = trips.map((t) => t.id);

  const { data: allParticipantsRaw } = tripIds.length
    ? await supabase.from("participants").select("*").in("trip_id", tripIds)
    : { data: [] };

  const allParticipants = (allParticipantsRaw ?? []) as Participant[];

  const participantsByTrip: Record<string, Participant[]> = {};
  for (const p of allParticipants) {
    if (!participantsByTrip[p.trip_id]) participantsByTrip[p.trip_id] = [];
    participantsByTrip[p.trip_id].push(p);
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-[var(--ink)]">Your trips</h1>
          <p className="text-sm text-[var(--ink-3)] mt-0.5">{trips.length} {trips.length === 1 ? "trip" : "trips"}</p>
        </div>
        <Link
          href="/trips/new"
          className="flex items-center gap-2 bg-[var(--accent)] text-white px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition"
        >
          <Plus size={16} />
          New trip
        </Link>
      </div>

      <TripGrid trips={trips} participantsByTrip={participantsByTrip} />
    </main>
  );
}
