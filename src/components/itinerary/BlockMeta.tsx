"use client";

import { useEffect, useState } from "react";
import type { ItineraryBlock, Participant } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity";
import Avatar from "@/components/ui/Avatar";
import MapLink from "@/components/ui/MapLink";
import { MessageCircle, ExternalLink, MapPin } from "lucide-react";

interface BlockMetaProps {
  block: ItineraryBlock;
  participants: Participant[];
  currentUserId: string | null;
  currentUserName: string | null;
}

// Bottom pill row on the collapsed view of ItineraryBlock + HikeBlock.
// Surfaces type-specific info: comments count, address (non-transport),
// booking link, and the Going avatar stack with an empty-state join slot.
// Heart + "Added by" live in the parent block's right rail, not here.
export default function BlockMeta({
  block,
  participants,
  currentUserId,
  currentUserName,
}: BlockMetaProps) {
  const [commentCount, setCommentCount] = useState<number | null>(null);
  const [bookingUserIds, setBookingUserIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const [c, b] = await Promise.all([
        supabase
          .from("comments")
          .select("id", { count: "exact", head: true })
          .eq("block_id", block.id),
        supabase
          .from("block_bookings")
          .select("user_id")
          .eq("block_id", block.id),
      ]);
      setCommentCount(c.count ?? 0);
      setBookingUserIds(((b.data ?? []) as { user_id: string | null }[])
        .map((row) => row.user_id)
        .filter((id): id is string => !!id));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.id]);

  const goers = bookingUserIds
    .map((uid) => participants.find((p) => p.user_id === uid))
    .filter(Boolean) as Participant[];
  const iAmGoing = !!currentUserId && bookingUserIds.includes(currentUserId);

  const isVenueType =
    block.type === "stay" ||
    block.type === "meal" ||
    block.type === "activity";

  const showComment = commentCount !== null && commentCount > 0;
  const showAddress = isVenueType && !!block.to_location;
  const showLink = !!block.booking_link;
  const showGoing = block.status !== "idea";

  if (!showComment && !showAddress && !showLink && !showGoing) {
    return null;
  }

  let linkHost = "";
  if (block.booking_link) {
    try {
      linkHost = new URL(block.booking_link).hostname.replace(/^www\./, "");
    } catch {
      linkHost = "booking";
    }
  }

  async function toggleGoing(e: React.MouseEvent) {
    e.stopPropagation();
    if (!currentUserId || busy) return;
    setBusy(true);
    try {
      if (iAmGoing) {
        setBookingUserIds((prev) => prev.filter((id) => id !== currentUserId));
        await supabase
          .from("block_bookings")
          .delete()
          .eq("block_id", block.id)
          .eq("user_id", currentUserId);
        await logActivity(supabase, {
          tripId: block.trip_id,
          userId: currentUserId,
          actorName: currentUserName,
          action: "block.left",
          targetId: block.id,
          summary: `left ${block.title}`,
        });
      } else {
        setBookingUserIds((prev) => [...prev, currentUserId]);
        await supabase.from("block_bookings").insert({
          block_id: block.id,
          user_id: currentUserId,
          name: currentUserName,
        } as Record<string, unknown>);
        await logActivity(supabase, {
          tripId: block.trip_id,
          userId: currentUserId,
          actorName: currentUserName,
          action: "block.joined",
          targetId: block.id,
          summary: `joined ${block.title}`,
        });
      }
    } finally {
      setBusy(false);
    }
  }

  const goerNames = goers.map((g) => g.name).filter(Boolean).join(", ");

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2">
      {showComment && (
        <span
          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-white text-[var(--ink-3)] border-[var(--paper-3)]"
          title={`${commentCount} comment${commentCount === 1 ? "" : "s"} — click block to read`}
        >
          <MessageCircle size={11} />
          <span>{commentCount}</span>
        </span>
      )}

      {showAddress && block.to_location && (
        <MapLink
          location={block.to_location}
          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-[var(--paper-2)] text-[var(--ink-2)] border-[var(--paper-3)] hover:bg-[var(--paper-3)] transition max-w-[220px]"
        >
          <MapPin size={11} />
          <span className="truncate">{block.to_location}</span>
        </MapLink>
      )}

      {showLink && block.booking_link && (
        <a
          href={block.booking_link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-[var(--paper-2)] text-[var(--ink-2)] border-[var(--paper-3)] hover:bg-[var(--paper-3)] transition max-w-[180px]"
          title={`Open ${block.booking_link}`}
        >
          <ExternalLink size={11} />
          <span className="truncate">{linkHost}</span>
        </a>
      )}

      {showGoing && (
        <button
          onClick={toggleGoing}
          disabled={!currentUserId || busy}
          title={
            goers.length === 0
              ? currentUserId
                ? "Tap to join — be the first"
                : "No one going yet"
              : currentUserId
                ? iAmGoing
                  ? `Going: ${goerNames}. Click to leave.`
                  : `Going: ${goerNames}. Click to join.`
                : `Going: ${goerNames}`
          }
          className="flex items-center -space-x-1.5 ml-0.5 disabled:cursor-default"
        >
          {goers.slice(0, 3).map((p) => (
            <span key={p.id} className="ring-2 ring-white rounded-full">
              <Avatar name={p.name} color={p.color} size="sm" />
            </span>
          ))}
          {goers.length > 3 && (
            <span className="ml-1 text-[10px] text-[var(--ink-3)]">+{goers.length - 3}</span>
          )}
          {goers.length === 0 && currentUserId && (
            <span
              className="w-7 h-7 rounded-full border-2 border-dashed border-[var(--paper-3)] hover:border-[var(--ink-3)] hover:bg-[var(--paper-2)] transition"
              aria-label="Tap to join — be the first"
            />
          )}
        </button>
      )}
    </div>
  );
}
