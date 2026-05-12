"use client";

import { useState, useEffect, useRef } from "react";
import type { Comment } from "@/lib/types";
import Avatar from "@/components/ui/Avatar";
import { createClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity";
import { Send } from "lucide-react";

interface BlockThreadProps {
  blockId: string;
  tripId: string;
  blockTitle: string;
  currentUserId: string | null;
  currentUserName: string | null;
  currentUserColor: string | null;
}

export default function BlockThread({
  blockId,
  tripId,
  blockTitle,
  currentUserId,
  currentUserName,
  currentUserColor,
}: BlockThreadProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase
      .from("comments")
      .select("*")
      .eq("block_id", blockId)
      .order("created_at")
      .then(({ data }) => setComments(data ?? []));

    const channel = supabase
      .channel(`comments:${blockId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "comments", filter: `block_id=eq.${blockId}` },
        (payload) => setComments((prev) => [...prev, payload.new as Comment])
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [blockId]);

  useEffect(() => {
    // Scroll the comment list to bottom — but ONLY inside the container, not the page
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [comments]);

  async function send() {
    if (!text.trim() || !currentUserId) return;
    const pending = text.trim();
    setSending(true);
    setText("");
    try {
      const { data: inserted, error } = await supabase
        .from("comments")
        .insert({
          block_id: blockId,
          user_id: currentUserId,
          author_name: currentUserName,
          author_color: currentUserColor,
          text: pending,
        } as Record<string, unknown>)
        .select()
        .single();
      if (error) throw error;
      if (inserted) {
        const newComment = inserted as Comment;
        setComments((prev) =>
          prev.some((c) => c.id === newComment.id) ? prev : [...prev, newComment]
        );
        await logActivity(supabase, {
          tripId,
          userId: currentUserId,
          actorName: currentUserName,
          action: "comment.posted",
          targetId: blockId,
          summary: `commented on ${blockTitle}`,
        });
      }
    } catch {
      setText(pending);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border-t border-[var(--paper-3)] pt-3 mt-3">
      <div ref={listRef} className="space-y-2 max-h-48 overflow-y-auto">
        {comments.map((c) => (
          <div key={c.id} className="flex gap-2 text-sm">
            <Avatar name={c.author_name} color={c.author_color} size="sm" />
            <div>
              <span className="font-medium text-[var(--ink-2)]">{c.author_name}</span>{" "}
              <span className="text-[var(--ink-3)]">{c.text}</span>
            </div>
          </div>
        ))}
      </div>
      {currentUserId && (
        <div className="flex gap-2 mt-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="Add a comment…"
            className="flex-1 text-sm bg-[var(--paper-2)] rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
          <button
            onClick={send}
            disabled={sending || !text.trim()}
            className="text-[var(--accent)] disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
