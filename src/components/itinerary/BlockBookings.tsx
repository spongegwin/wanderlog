"use client";

import { useState, useEffect } from "react";
import type { BlockBooking, Participant } from "@/lib/types";
import Avatar from "@/components/ui/Avatar";
import { createClient } from "@/lib/supabase/client";
import { Check } from "lucide-react";

interface BlockBookingsProps {
  blockId: string;
  participants: Participant[];
  currentUserId: string | null;
}

export default function BlockBookings({ blockId, participants, currentUserId }: BlockBookingsProps) {
  const [bookings, setBookings] = useState<BlockBooking[]>([]);
  const supabase = createClient();

  useEffect(() => {
    supabase
      .from("block_bookings")
      .select("*")
      .eq("block_id", blockId)
      .then(({ data }) => setBookings(data ?? []));
  }, [blockId]);

  async function toggleBooking() {
    if (!currentUserId) return;
    const existing = bookings.find((b) => b.user_id === currentUserId);
    if (existing) {
      await supabase.from("block_bookings").delete().eq("id", existing.id);
      setBookings((prev) => prev.filter((b) => b.id !== existing.id));
    } else {
      const me = participants.find((p) => p.user_id === currentUserId);
      const { data } = await supabase.from("block_bookings").insert({
        block_id: blockId,
        user_id: currentUserId,
        name: me?.name,
      } as Record<string, unknown>).select().single();
      if (data) setBookings((prev) => [...prev, data as BlockBooking]);
    }
  }

  const bookedIds = new Set(bookings.map((b) => b.user_id));

  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-[var(--ink-3)] mb-2 uppercase tracking-wide">Who's in</p>
      <div className="flex flex-wrap gap-2">
        {participants.map((p) => {
          const booked = bookedIds.has(p.user_id);
          const isMe = p.user_id === currentUserId;
          return (
            <button
              key={p.id}
              onClick={isMe ? toggleBooking : undefined}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                booked
                  ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                  : "bg-[var(--paper-2)] border-[var(--paper-3)] text-[var(--ink-3)]"
              } ${isMe ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
            >
              {booked && <Check size={10} />}
              <Avatar name={p.name} color={p.color} size="sm" />
              <span>{p.name ?? "?"}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
