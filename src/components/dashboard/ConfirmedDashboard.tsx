"use client";

import { useState } from "react";
import type { ItineraryBlock, Participant, BlockBooking } from "@/lib/types";
import NeedsAction from "./NeedsAction";
import CostSummary from "./CostSummary";

interface ConfirmedDashboardProps {
  blocks: ItineraryBlock[];
  participants: Participant[];
  bookings: BlockBooking[];
  tripStartDate: string | null;
  currentUserId: string | null;
  currentUserName: string | null;
  onRefresh: () => void;
}

type SubTab = "glance" | "flights" | "stays" | "reservations" | "needs-action";

export default function ConfirmedDashboard({
  blocks,
  participants,
  bookings,
  tripStartDate,
  currentUserId,
  currentUserName,
  onRefresh,
}: ConfirmedDashboardProps) {
  const [tab, setTab] = useState<SubTab>("glance");

  const confirmed = blocks.filter(
    (b) => b.status === "confirmed" || b.status === "completed"
  );
  const flights = confirmed.filter((b) => b.type === "flight");
  const stays = confirmed.filter((b) => b.type === "stay");
  const activities = confirmed.filter((b) => b.type === "activity" || b.type === "meal");
  const needsBooking = blocks.filter((b) => b.status === "suggested");

  const tabs: { id: SubTab; label: string }[] = [
    { id: "glance", label: "At a glance" },
    { id: "flights", label: "Flights" },
    { id: "stays", label: "Stays" },
    { id: "reservations", label: "Reservations" },
    { id: "needs-action", label: "Needs action" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-shrink-0 text-sm px-3 py-1.5 rounded-full transition ${
              tab === t.id
                ? "bg-[var(--ink)] text-white"
                : "text-[var(--ink-3)] hover:bg-[var(--paper-3)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "glance" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Flights" value={flights.length} icon="✈️" />
            <StatCard label="Stays" value={stays.length} icon="🏨" />
            <StatCard label="Activities" value={activities.length} icon="🎯" />
            <StatCard label="Needs booking" value={needsBooking.length} icon="⚠️" accent />
          </div>
          <div>
            <p className="text-xs font-medium text-[var(--ink-3)] uppercase tracking-wide mb-3">
              Budget
            </p>
            <CostSummary blocks={blocks} participants={participants.length} />
          </div>
        </div>
      )}

      {tab === "flights" && (
        <div className="space-y-3">
          {flights.length === 0 && (
            <p className="text-sm text-[var(--ink-3)] text-center py-6">No confirmed flights yet.</p>
          )}
          {flights.map((b) => (
            <div key={b.id} className="bg-white border border-[var(--paper-3)] rounded-xl p-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">✈️</span>
                <div>
                  <p className="font-semibold text-[var(--ink)]">{b.title}</p>
                  {b.subtitle && <p className="text-sm text-[var(--ink-3)]">{b.subtitle}</p>}
                  {b.booking_conf && (
                    <p className="text-xs font-mono text-[var(--ink-3)] mt-1">
                      {b.booking_conf}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "stays" && (
        <div className="space-y-3">
          {stays.length === 0 && (
            <p className="text-sm text-[var(--ink-3)] text-center py-6">No confirmed stays yet.</p>
          )}
          {stays.map((b) => (
            <div key={b.id} className="bg-white border border-[var(--paper-3)] rounded-xl p-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🏨</span>
                <div>
                  <p className="font-semibold text-[var(--ink)]">{b.title}</p>
                  {b.day_label && <p className="text-sm text-[var(--ink-3)]">{b.day_label}</p>}
                  {b.booking_conf && (
                    <p className="text-xs font-mono text-[var(--ink-3)] mt-1">{b.booking_conf}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "reservations" && (
        <div className="space-y-2">
          {confirmed.length === 0 && (
            <p className="text-sm text-[var(--ink-3)] text-center py-6">No reservations yet.</p>
          )}
          {confirmed
            .sort((a, b) => (a.day_label ?? "").localeCompare(b.day_label ?? ""))
            .map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-3 bg-white border border-[var(--paper-3)] rounded-xl px-4 py-3"
              >
                <span className="text-lg">{b.icon ?? "📍"}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[var(--ink)]">{b.title}</p>
                  {b.day_label && (
                    <p className="text-xs text-[var(--ink-3)]">{b.day_label}</p>
                  )}
                </div>
                <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                  Confirmed
                </span>
              </div>
            ))}
        </div>
      )}

      {tab === "needs-action" && (
        <NeedsAction
          blocks={blocks}
          participants={participants}
          bookings={bookings}
          tripStartDate={tripStartDate}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent = false,
}: {
  label: string;
  value: number;
  icon: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-4 border ${
        accent
          ? "bg-amber-50 border-amber-200"
          : "bg-white border-[var(--paper-3)]"
      }`}
    >
      <div className="text-2xl mb-1">{icon}</div>
      <div className={`text-2xl font-bold font-serif ${accent ? "text-amber-700" : "text-[var(--ink)]"}`}>
        {value}
      </div>
      <div className="text-xs text-[var(--ink-3)]">{label}</div>
    </div>
  );
}
