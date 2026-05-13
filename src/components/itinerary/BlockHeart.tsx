"use client";

import { useEffect, useState } from "react";
import type { Reaction, Participant } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity";
import { Heart } from "lucide-react";

const HEART = "❤️";

interface BlockHeartProps {
  blockId: string;
  blockTitle: string;
  tripId: string;
  participants: Participant[];
  currentUserId: string | null;
  currentUserName: string | null;
}

export default function BlockHeart({
  blockId,
  blockTitle,
  tripId,
  participants,
  currentUserId,
  currentUserName,
}: BlockHeartProps) {
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [busy, setBusy] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    supabase
      .from("reactions")
      .select("*")
      .eq("block_id", blockId)
      .eq("emoji", HEART)
      .then(({ data }) => setReactions((data ?? []) as Reaction[]));
  }, [blockId]);

  const myReaction = reactions.find((r) => r.user_id === currentUserId);
  const count = reactions.length;
  const names = reactions
    .map((r) => participants.find((p) => p.user_id === r.user_id)?.name)
    .filter(Boolean)
    .join(", ");

  async function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (!currentUserId || busy) return;
    setBusy(true);
    try {
      if (myReaction) {
        // Optimistic remove
        setReactions((prev) => prev.filter((r) => r.id !== myReaction.id));
        await supabase.from("reactions").delete().eq("id", myReaction.id);
      } else {
        const { data } = await supabase
          .from("reactions")
          .insert({
            block_id: blockId,
            user_id: currentUserId,
            emoji: HEART,
          } as Record<string, unknown>)
          .select()
          .single();
        if (data) {
          setReactions((prev) => [...prev, data as Reaction]);
          await logActivity(supabase, {
            tripId,
            userId: currentUserId,
            actorName: currentUserName,
            action: "block.hearted",
            targetId: blockId,
            summary: `hearted ${blockTitle}`,
          });
        }
      }
    } finally {
      setBusy(false);
    }
  }

  const tooltip = currentUserId
    ? count > 0
      ? names
      : "React"
    : "Sign in to react";

  return (
    <button
      onClick={toggle}
      disabled={!currentUserId || busy}
      title={tooltip}
      className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition ${
        myReaction
          ? "bg-rose-50 text-rose-600 border-rose-200"
          : "bg-white text-[var(--ink-3)] border-[var(--paper-3)] hover:bg-[var(--paper-2)]"
      } ${!currentUserId ? "cursor-default" : "cursor-pointer"} disabled:opacity-60`}
    >
      <Heart size={11} fill={myReaction ? "currentColor" : "none"} />
      {count > 0 && <span>{count}</span>}
    </button>
  );
}
