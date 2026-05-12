"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { Trip, Participant } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity";
import { assignColor } from "@/lib/utils";
import Avatar from "@/components/ui/Avatar";
import { X, Trash2, LogOut, Check, Link2, AlertTriangle, UserPlus } from "lucide-react";

interface TripSettingsModalProps {
  trip: Trip;
  participants: Participant[];
  currentUserId: string | null;
  currentUserName: string | null;
  onClose: () => void;
  onUpdated: () => void;
}

interface CrossTripMatch {
  participantId: string;
  tripId: string;
  tripName: string;
}

const inputCls =
  "w-full border border-[var(--paper-3)] rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)] bg-white";

export default function TripSettingsModal({
  trip,
  participants,
  currentUserId,
  currentUserName,
  onClose,
  onUpdated,
}: TripSettingsModalProps) {
  const router = useRouter();
  const supabase = createClient();
  const isCreator = trip.created_by === currentUserId;

  // Trip edit form state
  const [form, setForm] = useState({
    name: trip.name,
    destination: trip.destination ?? "",
    start_date: trip.start_date ?? "",
    end_date: trip.end_date ?? "",
    essence: trip.essence ?? "",
    photo_1_url: trip.photo_1_url ?? "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Add participant
  const [newName, setNewName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  // Cross-trip claim follow-up
  const [crossMatches, setCrossMatches] = useState<CrossTripMatch[] | null>(null);
  const [claimSelections, setClaimSelections] = useState<Set<string>>(new Set());
  const [claimedName, setClaimedName] = useState("");

  // Danger zone
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [acting, setActing] = useState(false);

  useEffect(() => {
    setForm({
      name: trip.name,
      destination: trip.destination ?? "",
      start_date: trip.start_date ?? "",
      end_date: trip.end_date ?? "",
      essence: trip.essence ?? "",
      photo_1_url: trip.photo_1_url ?? "",
    });
  }, [trip]);

  async function saveTrip() {
    setSavingEdit(true);
    await supabase
      .from("trips")
      .update({
        name: form.name.trim(),
        destination: form.destination.trim() || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        essence: form.essence.trim() || null,
        photo_1_url: form.photo_1_url.trim() || null,
      })
      .eq("id", trip.id);
    setSavingEdit(false);
    onUpdated();
  }

  async function claim(participant: Participant) {
    if (!currentUserId) return;
    // Update this row
    await supabase
      .from("participants")
      .update({ user_id: currentUserId })
      .eq("id", participant.id);

    // Activity log
    await logActivity(supabase, {
      tripId: trip.id,
      userId: currentUserId,
      actorName: currentUserName,
      action: "participant.linked",
      summary: `linked their profile to ${participant.name ?? "an unlinked participant"}`,
    });

    // Find matches in other trips
    const { data: myMemberships } = await supabase
      .from("participants")
      .select("trip_id")
      .eq("user_id", currentUserId);

    const otherTripIds = (myMemberships ?? [])
      .map((m) => (m as { trip_id: string }).trip_id)
      .filter((id) => id !== trip.id);

    if (otherTripIds.length > 0 && participant.name) {
      const { data: candidates } = await supabase
        .from("participants")
        .select("id, trip_id, name")
        .in("trip_id", otherTripIds)
        .is("user_id", null)
        .ilike("name", participant.name);

      if (candidates && candidates.length > 0) {
        const tripIds = (candidates as { trip_id: string }[]).map((c) => c.trip_id);
        const { data: tripRows } = await supabase
          .from("trips")
          .select("id, name")
          .in("id", tripIds);
        const tripNames = new Map(
          (tripRows ?? []).map((t) => [(t as { id: string; name: string }).id, (t as { id: string; name: string }).name])
        );
        const matches: CrossTripMatch[] = (candidates as { id: string; trip_id: string }[]).map((c) => ({
          participantId: c.id,
          tripId: c.trip_id,
          tripName: tripNames.get(c.trip_id) ?? "Trip",
        }));
        setCrossMatches(matches);
        setClaimSelections(new Set(matches.map((m) => m.participantId)));
        setClaimedName(participant.name);
        onUpdated();
        return;
      }
    }

    onUpdated();
  }

  async function confirmCrossClaim() {
    if (!currentUserId || !crossMatches) return;
    const toUpdate = crossMatches.filter((m) => claimSelections.has(m.participantId));
    for (const m of toUpdate) {
      await supabase
        .from("participants")
        .update({ user_id: currentUserId })
        .eq("id", m.participantId);
      await logActivity(supabase, {
        tripId: m.tripId,
        userId: currentUserId,
        actorName: currentUserName,
        action: "participant.linked",
        summary: `linked their profile to ${claimedName}`,
      });
    }
    setCrossMatches(null);
    setClaimSelections(new Set());
    onUpdated();
  }

  async function removeParticipant(p: Participant) {
    if (!isCreator) return;
    if (!confirm(`Remove ${p.name ?? "this participant"} from the trip?`)) return;
    await supabase.from("participants").delete().eq("id", p.id);
    if (currentUserId) {
      await logActivity(supabase, {
        tripId: trip.id,
        userId: currentUserId,
        actorName: currentUserName,
        action: "participant.removed",
        summary: `removed ${p.name ?? "a participant"}`,
      });
    }
    onUpdated();
  }

  async function addParticipant() {
    const name = newName.trim();
    if (!name || !isCreator) return;
    setAddError(null);
    const { error } = await supabase.from("participants").insert({
      trip_id: trip.id,
      user_id: null,
      name,
      role: "invited",
      color: assignColor(participants.length),
    } as Record<string, unknown>);
    if (error) {
      setAddError(error.message);
      return;
    }
    setNewName("");
    if (currentUserId) {
      await logActivity(supabase, {
        tripId: trip.id,
        userId: currentUserId,
        actorName: currentUserName,
        action: "participant.added",
        summary: `added ${name}`,
      });
    }
    onUpdated();
  }

  async function leaveTrip() {
    if (!currentUserId) return;
    if (!confirm(`Leave ${trip.name}? You won't see this trip again unless re-invited.`)) return;
    setActing(true);
    await logActivity(supabase, {
      tripId: trip.id,
      userId: currentUserId,
      actorName: currentUserName,
      action: "participant.left",
      summary: `left the trip`,
    });
    await supabase
      .from("participants")
      .delete()
      .eq("trip_id", trip.id)
      .eq("user_id", currentUserId);
    setActing(false);
    router.push("/");
    router.refresh();
  }

  async function deleteTrip() {
    if (!isCreator) return;
    setActing(true);
    await supabase.from("trips").delete().eq("id", trip.id);
    setActing(false);
    router.push("/");
    router.refresh();
  }

  // Cross-trip claim follow-up modal
  if (crossMatches !== null) {
    const modal = (
      <div
        className="fixed inset-0 z-[110] bg-black/40 flex items-center justify-center p-4"
        onClick={() => setCrossMatches(null)}
      >
        <div
          className="bg-white rounded-2xl max-w-md w-full shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-5 py-3 border-b border-[var(--paper-3)]">
            <h3 className="font-semibold text-[var(--ink)]">Link other trips?</h3>
            <p className="text-xs text-[var(--ink-3)] mt-0.5">
              Found unlinked &quot;{claimedName}&quot; in {crossMatches.length}{" "}
              {crossMatches.length === 1 ? "other trip" : "other trips"} you&apos;re part of.
            </p>
          </div>
          <ul className="px-5 py-3 space-y-2">
            {crossMatches.map((m) => (
              <li key={m.participantId}>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={claimSelections.has(m.participantId)}
                    onChange={(e) => {
                      setClaimSelections((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(m.participantId);
                        else next.delete(m.participantId);
                        return next;
                      });
                    }}
                  />
                  <span>{m.tripName}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="px-5 py-3 border-t border-[var(--paper-3)] flex justify-end gap-2">
            <button
              onClick={() => setCrossMatches(null)}
              className="text-sm text-[var(--ink-3)] px-3 py-1.5 hover:text-[var(--ink)]"
            >
              Skip
            </button>
            <button
              onClick={confirmCrossClaim}
              disabled={claimSelections.size === 0}
              className="text-sm bg-[var(--accent)] text-white px-4 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-40"
            >
              Link {claimSelections.size}{" "}
              {claimSelections.size === 1 ? "trip" : "trips"}
            </button>
          </div>
        </div>
      </div>
    );
    if (typeof window === "undefined") return null;
    return createPortal(modal, document.body);
  }

  const modal = (
    <div
      className="fixed inset-0 z-[100] bg-black/30 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-[var(--paper-3)] px-5 py-3 flex items-center justify-between">
          <h2 className="font-semibold text-[var(--ink)]">Trip settings</h2>
          <button
            onClick={onClose}
            className="text-[var(--ink-3)] hover:text-[var(--ink)] p-1"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {/* Section A — Participants */}
          <section className="space-y-3">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">
                Participants
              </h3>
              <p className="text-xs text-[var(--ink-3)] mt-0.5">
                Claim an unlinked row if it&apos;s you. Organizer can remove anyone.
              </p>
            </div>

            <ul className="space-y-1.5">
              {participants.map((p) => {
                const linked = !!p.user_id;
                const isCurrent = p.user_id === currentUserId;
                return (
                  <li
                    key={p.id}
                    className="flex items-center gap-2 bg-[var(--paper-2)] rounded-lg px-3 py-2"
                  >
                    <Avatar name={p.name} color={p.color} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--ink)]">
                        {p.name ?? "Unnamed"}
                        {isCurrent && (
                          <span className="text-xs text-[var(--ink-3)] font-normal ml-1">
                            (you)
                          </span>
                        )}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] uppercase tracking-wide text-[var(--ink-3)]">
                          {p.role}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            linked
                              ? "bg-green-100 text-green-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {linked ? "✓ linked" : "⊘ unlinked"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {!linked && currentUserId && (
                        <button
                          onClick={() => claim(p)}
                          className="flex items-center gap-1 text-xs bg-[var(--accent)] text-white px-2.5 py-1 rounded-lg hover:opacity-90"
                          title="Link this participant to your account"
                        >
                          <Link2 size={11} />
                          This is me
                        </button>
                      )}
                      {isCreator && !isCurrent && (
                        <button
                          onClick={() => removeParticipant(p)}
                          className="text-[var(--ink-3)] hover:text-red-500 p-1"
                          title="Remove participant"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {isCreator && (
              <div className="pt-1">
                <div className="flex items-center gap-2">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addParticipant()}
                    placeholder="Add a participant by name…"
                    className={inputCls}
                  />
                  <button
                    onClick={addParticipant}
                    disabled={!newName.trim()}
                    className="flex items-center gap-1 text-sm text-[var(--accent)] disabled:opacity-30 p-1.5"
                  >
                    <UserPlus size={14} />
                  </button>
                </div>
                {addError && (
                  <p className="text-xs text-red-600 mt-1">{addError}</p>
                )}
              </div>
            )}
          </section>

          {/* Section B — Edit trip */}
          {isCreator && (
            <section className="space-y-3 border-t border-[var(--paper-3)] pt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">
                Trip details
              </h3>
              <Field label="Name">
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className={inputCls}
                />
              </Field>
              <Field label="Destination">
                <input
                  value={form.destination}
                  onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
                  className={inputCls}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start date">
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                    className={inputCls}
                  />
                </Field>
                <Field label="End date">
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                    className={inputCls}
                  />
                </Field>
              </div>
              <Field label="Essence">
                <textarea
                  value={form.essence}
                  onChange={(e) => setForm((f) => ({ ...f, essence: e.target.value }))}
                  rows={2}
                  className={inputCls}
                />
              </Field>
              <Field label="Cover photo URL">
                <input
                  value={form.photo_1_url}
                  onChange={(e) => setForm((f) => ({ ...f, photo_1_url: e.target.value }))}
                  placeholder="https://…"
                  className={inputCls}
                />
              </Field>
              <button
                onClick={saveTrip}
                disabled={savingEdit}
                className="text-sm bg-[var(--ink)] text-white px-4 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-40 flex items-center gap-1.5"
              >
                <Check size={13} />
                {savingEdit ? "Saving…" : "Save changes"}
              </button>
            </section>
          )}

          {/* Section C — Danger zone */}
          <section className="space-y-3 border-t border-red-200 pt-5">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-red-600" />
              <h3 className="text-xs font-semibold uppercase tracking-wide text-red-700">
                Danger zone
              </h3>
            </div>

            {!isCreator && currentUserId && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <p className="text-sm font-medium text-[var(--ink)]">Leave this trip</p>
                <p className="text-xs text-[var(--ink-3)] mt-0.5 mb-2">
                  You won&apos;t see {trip.name} again unless re-invited. Your comments and bookings stay.
                </p>
                <button
                  onClick={leaveTrip}
                  disabled={acting}
                  className="flex items-center gap-1.5 text-sm bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  <LogOut size={13} />
                  Leave trip
                </button>
              </div>
            )}

            {isCreator && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <p className="text-sm font-medium text-[var(--ink)]">Delete this trip</p>
                <p className="text-xs text-[var(--ink-3)] mt-0.5 mb-2">
                  Permanently removes the trip, all blocks, comments, packing items, and history.
                  Type the trip name to confirm.
                </p>
                <input
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder={trip.name}
                  className="w-full text-sm border border-red-300 rounded px-2 py-1.5 mb-2 bg-white outline-none focus:ring-1 focus:ring-red-400"
                />
                <button
                  onClick={deleteTrip}
                  disabled={acting || deleteConfirm.trim() !== trip.name}
                  className="flex items-center gap-1.5 text-sm bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-40"
                >
                  <Trash2 size={13} />
                  Delete trip permanently
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );

  if (typeof window === "undefined") return null;
  return createPortal(modal, document.body);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[var(--ink-3)]">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
