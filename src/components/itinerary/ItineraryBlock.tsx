"use client";

import { useState } from "react";
import type { ItineraryBlock, Participant } from "@/lib/types";
import HikeBlock from "./HikeBlock";
import StatusBadge from "@/components/ui/StatusBadge";
import BlockThread from "./BlockThread";
import BlockEditor from "./BlockEditor";
import BlockMeta from "./BlockMeta";
import BlockHeart from "./BlockHeart";
import MapLink from "@/components/ui/MapLink";
import { ChevronDown, ChevronUp, Pencil, ExternalLink } from "lucide-react";

interface ItineraryBlockProps {
  block: ItineraryBlock;
  participants: Participant[];
  currentUserId: string | null;
  currentUserName: string | null;
  currentUserColor: string | null;
  allDayLabels: string[];
  onUpdated: () => void;
}

const TYPE_LABEL: Record<string, string> = {
  flight: "Flight",
  stay: "Stay",
  activity: "Activity",
  meal: "Meal",
  transport: "Transport",
  idea: "Idea",
};

const TYPE_COLOR: Record<string, string> = {
  flight: "text-[var(--sky)]",
  stay: "text-[var(--green)]",
  activity: "text-[var(--accent)]",
  meal: "text-[var(--accent-2)]",
  transport: "text-[var(--ink-2)]",
  idea: "text-[var(--ink-3)]",
};

export default function ItineraryBlockComponent({
  block,
  participants,
  currentUserId,
  currentUserName,
  currentUserColor,
  allDayLabels,
  onUpdated,
}: ItineraryBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const [showBlockEditor, setShowBlockEditor] = useState(false);

  function toggleExpand() {
    const y = window.scrollY;
    setExpanded((v) => !v);
    requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "instant" }));
  }

  if (block.type === "hike" || block.type === "rest") {
    return (
      <HikeBlock
        block={block}
        participants={participants}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        currentUserColor={currentUserColor}
        allDayLabels={allDayLabels}
        onUpdated={onUpdated}
      />
    );
  }

  const typeLabel = TYPE_LABEL[block.type] ?? block.type;
  const typeColor = TYPE_COLOR[block.type] ?? "text-[var(--ink-3)]";
  const isTransport = block.type === "transport" || block.type === "flight";
  const transportSummary: string[] = [];
  if (isTransport) {
    if (block.distance_mi) transportSummary.push(`${block.distance_mi} mi`);
    if (block.duration_min) {
      const h = Math.floor(block.duration_min / 60);
      const m = block.duration_min % 60;
      transportSummary.push(h > 0 ? `${h}h ${m}m` : `${m}m`);
    }
  }

  return (
    <div className="bg-white border border-[var(--paper-3)] rounded-xl overflow-hidden">
      <div
        role="button"
        tabIndex={0}
        className="w-full text-left p-4 cursor-pointer select-none group"
        onClick={toggleExpand}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleExpand();
          }
        }}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-semibold uppercase tracking-wide ${typeColor}`}>
                {typeLabel}
              </span>
              <span className="font-semibold text-[var(--ink)]">{block.title}</span>
              <StatusBadge status={block.status} />
            </div>
            {isTransport && (block.from_location || block.to_location) && (
              <p className="text-sm text-[var(--ink-2)] mt-0.5">
                <MapLink location={block.from_location} fallback="?" />
                {" → "}
                <MapLink location={block.to_location} fallback="?" />
              </p>
            )}
            {block.subtitle && (
              <p className="text-sm text-[var(--ink-3)] mt-0.5">{block.subtitle}</p>
            )}
            {transportSummary.length > 0 && (
              <div className="flex flex-wrap gap-3 mt-1 text-xs text-[var(--ink-3)]">
                {transportSummary.map((s, i) => <span key={i}>{s}</span>)}
              </div>
            )}
            <BlockMeta
              block={block}
              participants={participants}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
            />
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <BlockHeart
              blockId={block.id}
              blockTitle={block.title}
              tripId={block.trip_id}
              participants={participants}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
            />
            {currentUserId && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowBlockEditor(true);
                }}
                className="p-1 rounded transition text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--paper-2)]"
                title="Edit block"
              >
                <Pencil size={13} />
              </button>
            )}
            <div className="text-[var(--ink-3)]">
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[var(--paper-3)] px-4 pb-4 pt-3 space-y-3">
          {block.booking_conf && (
            <p className="text-xs text-[var(--ink-3)]">
              Confirmation:{" "}
              <span className="font-mono text-[var(--ink-2)]">{block.booking_conf}</span>
            </p>
          )}
          {block.cancel_deadline && (
            <p className="text-xs text-amber-700">
              Cancel by: {new Date(block.cancel_deadline).toLocaleDateString()}
            </p>
          )}
          {block.booking_link && (
            <a
              href={block.booking_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium bg-[var(--accent)] text-white px-3 py-1.5 rounded-lg hover:opacity-90 transition"
            >
              <ExternalLink size={13} />
              {block.status === "confirmed" || block.status === "completed"
                ? "View booking"
                : "Open booking site"}
            </a>
          )}
          {block.booking_details && (
            <p className="text-sm text-[var(--ink-2)]">{block.booking_details}</p>
          )}

          <BlockThread
            blockId={block.id}
            tripId={block.trip_id}
            blockTitle={block.title}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            currentUserColor={currentUserColor}
          />
        </div>
      )}

      {showBlockEditor && (
        <BlockEditor
          block={block}
          allDayLabels={allDayLabels}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          onClose={() => setShowBlockEditor(false)}
          onSaved={onUpdated}
          onDeleted={onUpdated}
        />
      )}
    </div>
  );
}
