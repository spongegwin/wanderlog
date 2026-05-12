import Link from "next/link";
import type { Trip, Participant } from "@/lib/types";
import TripCard from "./TripCard";

interface TripGridProps {
  trips: Trip[];
  participantsByTrip: Record<string, Participant[]>;
}

export default function TripGrid({ trips, participantsByTrip }: TripGridProps) {
  const upcoming = trips.filter((t) => t.status === "upcoming");
  const past = trips.filter((t) => t.status === "past");

  if (trips.length === 0) {
    return (
      <div className="bg-white border border-dashed border-[var(--paper-3)] rounded-2xl py-16 px-6 text-center max-w-md mx-auto">
        <p className="font-serif text-2xl text-[var(--ink)] mb-2">No trips yet</p>
        <p className="text-sm text-[var(--ink-3)] mb-6">
          Start planning your first adventure — a weekend hike, a flight to anywhere, a long-overdue reunion.
        </p>
        <Link
          href="/trips/new"
          className="inline-block bg-[var(--accent)] text-white px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition"
        >
          Start your first trip →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {upcoming.length > 0 && (
        <section>
          <h2 className="font-serif text-xl font-semibold text-[var(--ink)] mb-4">Upcoming</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcoming.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                participants={participantsByTrip[trip.id] ?? []}
              />
            ))}
          </div>
        </section>
      )}
      {past.length > 0 && (
        <section>
          <h2 className="font-serif text-xl font-semibold text-[var(--ink-2)] mb-4">Past</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-75">
            {past.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                participants={participantsByTrip[trip.id] ?? []}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
