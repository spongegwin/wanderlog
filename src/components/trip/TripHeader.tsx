"use client";

import { useState } from "react";
import type { Trip, Participant, ItineraryBlock } from "@/lib/types";
import Avatar from "@/components/ui/Avatar";
import { formatDateRange } from "@/lib/utils";
import TripSettingsModal from "./TripSettingsModal";
import { Check, Copy, Calendar, Settings } from "lucide-react";

interface TripHeaderProps {
  trip: Trip;
  participants: Participant[];
  blocks: ItineraryBlock[];
  currentUserId: string | null;
  currentUserName: string | null;
  onUpdated: () => void;
}

// Parse the leading number from strings like "13.1 mi", "3,400 ft"
function parseLeadingNumber(s: string | null | undefined): number {
  if (!s) return 0;
  const m = s.match(/[\d,.]+/);
  if (!m) return 0;
  const n = parseFloat(m[0].replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

export default function TripHeader({
  trip,
  participants,
  blocks,
  currentUserId,
  currentUserName,
  onUpdated,
}: TripHeaderProps) {
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const inviteUrl = trip.invite_token
    ? `${window.location.origin}/trips/${trip.id}/join/${trip.invite_token}`
    : null;

  async function copyInvite() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Aggregate stats — prefer trip date range, fall back to distinct day_labels
  let distinctDays = 0;
  if (trip.start_date && trip.end_date) {
    const start = new Date(trip.start_date + "T00:00:00").getTime();
    const end = new Date(trip.end_date + "T00:00:00").getTime();
    distinctDays = Math.floor((end - start) / 86400000) + 1;
  } else {
    distinctDays = new Set(
      blocks.map((b) => b.day_label).filter(Boolean) as string[]
    ).size;
  }
  const totalDistance = blocks.reduce((sum, b) => sum + parseLeadingNumber(b.hike_distance), 0);
  const totalGain = blocks.reduce((sum, b) => sum + parseLeadingNumber(b.hike_elev_gain), 0);
  const blockCount = blocks.length;
  const confirmedCount = blocks.filter((b) => b.status === "confirmed").length;

  const stats: string[] = [];
  if (distinctDays > 0) stats.push(`${distinctDays} ${distinctDays === 1 ? "day" : "days"}`);
  if (totalDistance > 0) stats.push(`${totalDistance.toFixed(1)} mi`);
  if (totalGain > 0) stats.push(`↑ ${totalGain.toLocaleString()} ft`);
  if (blockCount > 0) {
    stats.push(`${confirmedCount}/${blockCount} blocks confirmed`);
  }

  return (
    <div className="border-b border-[var(--paper-3)] pb-6">
      {trip.photo_1_url && (
        <div className="h-52 rounded-2xl overflow-hidden mb-6 bg-[var(--paper-2)]">
          <img src={trip.photo_1_url} alt={trip.name} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
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
            <p className="text-sm italic text-[var(--ink-2)] mt-2">"{trip.essence}"</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            href={`/api/trips/${trip.id}/calendar.ics`}
            className="flex items-center gap-2 text-sm bg-[var(--paper-2)] hover:bg-[var(--paper-3)] px-3 py-1.5 rounded-full transition-colors"
            title="Download trip as .ics calendar file"
          >
            <Calendar size={14} />
            .ics
          </a>
          {inviteUrl && (
            <button
              onClick={copyInvite}
              className="flex items-center gap-2 text-sm bg-[var(--paper-2)] hover:bg-[var(--paper-3)] px-3 py-1.5 rounded-full transition-colors"
            >
              {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
              {copied ? "Copied!" : "Invite"}
            </button>
          )}
          {currentUserId && (
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 text-sm bg-[var(--paper-2)] hover:bg-[var(--paper-3)] px-3 py-1.5 rounded-full transition-colors"
              title="Trip settings"
            >
              <Settings size={14} />
            </button>
          )}
        </div>
      </div>

      {(participants.length > 0 || stats.length > 0) && (
        <div className="flex items-center justify-between gap-3 mt-4 flex-wrap">
          {participants.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {participants.map((p) => (
                  <Avatar key={p.id} name={p.name} color={p.color} size="sm" />
                ))}
              </div>
              <span className="text-sm text-[var(--ink-3)]">
                {participants.length} {participants.length === 1 ? "person" : "people"}
              </span>
            </div>
          )}
          {stats.length > 0 && (
            <p className="text-xs text-[var(--ink-3)] font-medium">
              {stats.join(" · ")}
            </p>
          )}
        </div>
      )}

      {showSettings && (
        <TripSettingsModal
          trip={trip}
          participants={participants}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          onClose={() => setShowSettings(false)}
          onUpdated={onUpdated}
        />
      )}
    </div>
  );
}
