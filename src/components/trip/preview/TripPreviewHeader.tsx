import type { Trip, ItineraryBlock } from "@/lib/types";
import { formatDateRange } from "@/lib/utils";

interface TripPreviewHeaderProps {
  trip: Trip;
  blocks: ItineraryBlock[];
  participantCount: number;
}

function parseLeadingNumber(s: string | null | undefined): number {
  if (!s) return 0;
  const m = s.match(/[\d,.]+/);
  if (!m) return 0;
  const n = parseFloat(m[0].replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

export default function TripPreviewHeader({ trip, blocks, participantCount }: TripPreviewHeaderProps) {
  let distinctDays = 0;
  if (trip.start_date && trip.end_date) {
    const start = new Date(trip.start_date + "T00:00:00").getTime();
    const end = new Date(trip.end_date + "T00:00:00").getTime();
    distinctDays = Math.floor((end - start) / 86400000) + 1;
  } else {
    distinctDays = new Set(blocks.map((b) => b.day_label).filter(Boolean) as string[]).size;
  }
  const totalDistance = blocks.reduce((sum, b) => sum + parseLeadingNumber(b.hike_distance), 0);
  const totalGain = blocks.reduce((sum, b) => sum + parseLeadingNumber(b.hike_elev_gain), 0);
  const confirmedCount = blocks.filter((b) => b.status === "confirmed").length;

  const stats: string[] = [];
  if (distinctDays > 0) stats.push(`${distinctDays} ${distinctDays === 1 ? "day" : "days"}`);
  if (totalDistance > 0) stats.push(`${totalDistance.toFixed(1)} mi`);
  if (totalGain > 0) stats.push(`↑ ${totalGain.toLocaleString()} ft`);
  if (blocks.length > 0) stats.push(`${confirmedCount}/${blocks.length} blocks confirmed`);
  if (participantCount > 0) stats.push(`${participantCount} ${participantCount === 1 ? "person" : "people"}`);

  return (
    <div className="border-b border-[var(--paper-3)] pb-6">
      {trip.photo_1_url && (
        <div className="h-52 rounded-2xl overflow-hidden mb-6 bg-[var(--paper-2)]">
          <img src={trip.photo_1_url} alt={trip.name} className="w-full h-full object-cover" />
        </div>
      )}
      <h1 className="font-serif text-3xl font-bold text-[var(--ink)]">{trip.name}</h1>
      {trip.destination && (
        <p className="text-[var(--ink-2)] mt-1">{trip.destination}</p>
      )}
      {(trip.start_date || trip.end_date) && (
        <p className="text-sm text-[var(--ink-3)] mt-0.5">
          {formatDateRange(trip.start_date, trip.end_date)}
        </p>
      )}
      {trip.essence && (
        <p className="text-sm italic text-[var(--ink-2)] mt-2">&ldquo;{trip.essence}&rdquo;</p>
      )}
      {stats.length > 0 && (
        <p className="text-xs text-[var(--ink-3)] font-medium mt-3">{stats.join(" · ")}</p>
      )}
    </div>
  );
}
