import Link from "next/link";
import type { Trip, Participant } from "@/lib/types";
import Avatar from "@/components/ui/Avatar";
import { formatDateRange } from "@/lib/utils";

interface TripCardProps {
  trip: Trip;
  participants: Participant[];
}

export default function TripCard({ trip, participants }: TripCardProps) {
  return (
    <Link href={`/trips/${trip.id}`}>
      <div className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-[var(--paper-3)] cursor-pointer">
        <div className="relative h-44 bg-[var(--paper-2)]">
          {trip.photo_1_url && (
            <img
              src={trip.photo_1_url}
              alt={trip.name}
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <div className="absolute bottom-3 left-3 right-3">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              trip.status === "upcoming"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-[var(--paper-3)] text-[var(--ink-3)]"
            }`}>
              {trip.status === "upcoming" ? "Upcoming" : "Past"}
            </span>
          </div>
        </div>

        <div className="p-4">
          <h2 className="font-serif text-lg font-semibold text-[var(--ink)] leading-tight">
            {trip.name}
          </h2>
          {trip.destination && (
            <p className="text-sm text-[var(--ink-3)] mt-0.5">{trip.destination}</p>
          )}
          {(trip.start_date || trip.end_date) && (
            <p className="text-xs text-[var(--ink-3)] mt-1">
              {formatDateRange(trip.start_date, trip.end_date)}
            </p>
          )}
          {trip.essence && (
            <p className="text-sm text-[var(--ink-2)] mt-2 line-clamp-2 italic">
              "{trip.essence}"
            </p>
          )}
          {participants.length > 0 && (
            <div className="flex items-center gap-1 mt-3">
              <div className="flex -space-x-2">
                {participants.slice(0, 5).map((p) => (
                  <Avatar key={p.id} name={p.name} color={p.color} size="sm" />
                ))}
              </div>
              {participants.length > 5 && (
                <span className="text-xs text-[var(--ink-3)] ml-1">
                  +{participants.length - 5}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
