"use client";

import { useEffect, useState } from "react";
import type { BlockVote } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { ThumbsUp, ThumbsDown } from "lucide-react";

interface BlockVotesProps {
  blockId: string;
  currentUserId: string | null;
}

export default function BlockVotes({ blockId, currentUserId }: BlockVotesProps) {
  const [votes, setVotes] = useState<BlockVote[]>([]);
  const [busy, setBusy] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    supabase
      .from("block_votes")
      .select("*")
      .eq("block_id", blockId)
      .then(({ data }) => setVotes((data ?? []) as BlockVote[]));
  }, [blockId]);

  const myVote = votes.find((v) => v.user_id === currentUserId)?.vote ?? null;
  const upCount = votes.filter((v) => v.vote === "up").length;
  const downCount = votes.filter((v) => v.vote === "down").length;

  async function cast(next: "up" | "down") {
    if (!currentUserId || busy) return;
    setBusy(true);
    try {
      if (myVote === next) {
        // Clicking your current vote clears it
        await supabase
          .from("block_votes")
          .delete()
          .eq("block_id", blockId)
          .eq("user_id", currentUserId);
        setVotes((prev) => prev.filter((v) => v.user_id !== currentUserId));
      } else {
        const { data } = await supabase
          .from("block_votes")
          .upsert(
            {
              block_id: blockId,
              user_id: currentUserId,
              vote: next,
            } as Record<string, unknown>,
            { onConflict: "block_id,user_id" }
          )
          .select()
          .single();
        if (data) {
          const inserted = data as BlockVote;
          setVotes((prev) => {
            const others = prev.filter((v) => v.user_id !== currentUserId);
            return [...others, inserted];
          });
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={(e) => {
          e.stopPropagation();
          cast("up");
        }}
        disabled={!currentUserId || busy}
        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition ${
          myVote === "up"
            ? "bg-[var(--green)] text-white border-[var(--green)]"
            : "bg-white text-[var(--ink-3)] border-[var(--paper-3)] hover:bg-[var(--paper-2)]"
        } disabled:opacity-50`}
        title={currentUserId ? "Vote yes" : "Sign in to vote"}
      >
        <ThumbsUp size={11} />
        {upCount > 0 && <span>{upCount}</span>}
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          cast("down");
        }}
        disabled={!currentUserId || busy}
        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition ${
          myVote === "down"
            ? "bg-[var(--ink)] text-white border-[var(--ink)]"
            : "bg-white text-[var(--ink-3)] border-[var(--paper-3)] hover:bg-[var(--paper-2)]"
        } disabled:opacity-50`}
        title={currentUserId ? "Vote no" : "Sign in to vote"}
      >
        <ThumbsDown size={11} />
        {downCount > 0 && <span>{downCount}</span>}
      </button>
    </div>
  );
}
