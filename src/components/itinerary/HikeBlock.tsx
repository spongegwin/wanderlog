"use client";

import { useState } from "react";
import type { HikeWaypoint, ItineraryBlock, Participant } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import StatusBadge from "@/components/ui/StatusBadge";
import DifficultyBadge from "@/components/ui/DifficultyBadge";
import ElevationProfile from "@/components/ui/ElevationProfile";
import WeatherStrip from "@/components/ui/WeatherStrip";
import BlockThread from "./BlockThread";
import WaypointTable from "./WaypointTable";
import WaypointTableEditor from "./WaypointTableEditor";
import BlockEditor from "./BlockEditor";
import BlockMeta from "./BlockMeta";
import BlockHeart from "./BlockHeart";
import MapLink from "@/components/ui/MapLink";
import { ChevronDown, ChevronUp, Pencil, ExternalLink } from "lucide-react";

interface HikeBlockProps {
  block: ItineraryBlock;
  participants: Participant[];
  currentUserId: string | null;
  currentUserName: string | null;
  currentUserColor: string | null;
  allDayLabels: string[];
  onUpdated: () => void;
}

export default function HikeBlock({
  block,
  participants,
  currentUserId,
  currentUserName,
  currentUserColor,
  allDayLabels,
  onUpdated,
}: HikeBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showBlockEditor, setShowBlockEditor] = useState(false);
  const isRest = block.type === "rest";

  function toggleExpand() {
    const y = window.scrollY;
    setExpanded((v) => !v);
    setEditing(false);
    requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "instant" }));
  }

  const elevProfile = Array.isArray(block.hike_elev_profile)
    ? (block.hike_elev_profile as number[])
    : null;

  const waypoints = Array.isArray(block.hike_waypoints)
    ? (block.hike_waypoints as HikeWaypoint[])
    : null;


  async function saveWaypoints(updated: HikeWaypoint[]) {
    const supabase = createClient();
    await supabase
      .from("itinerary_blocks")
      .update({ hike_waypoints: updated } as Record<string, unknown>)
      .eq("id", block.id);
    setEditing(false);
    onUpdated();
  }

  return (
    <div
      className={`bg-white border rounded-xl overflow-hidden ${
        isRest ? "border-[var(--paper-3)]" : "border-l-4 border-l-[var(--green)] border-[var(--paper-3)]"
      }`}
    >
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
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--green)]">
                {isRest ? "Rest" : "Hike"}
              </span>
              <span className="font-semibold text-[var(--ink)]">{block.title}</span>
              <StatusBadge status={block.status} />
              {block.hike_difficulty && <DifficultyBadge difficulty={block.hike_difficulty} />}
            </div>

            {!isRest && (block.hike_start || block.hike_end) && (
              <p className="text-sm text-[var(--ink-3)] mt-0.5">
                {block.hike_start && (
                  <>
                    <MapLink location={block.hike_start} />
                    {block.hike_start_elev && ` (${block.hike_start_elev})`}
                  </>
                )}
                {block.hike_start && block.hike_end && " → "}
                {block.hike_end && (
                  <>
                    <MapLink location={block.hike_end} />
                    {block.hike_end_elev && ` (${block.hike_end_elev})`}
                  </>
                )}
              </p>
            )}

            {!isRest && (
              <div className="flex flex-wrap gap-3 mt-1 text-xs text-[var(--ink-3)]">
                {block.hike_distance && <span>{block.hike_distance}</span>}
                {block.hike_elev_gain && <span>↑ {block.hike_elev_gain}</span>}
                {block.hike_est_hours && <span>{block.hike_est_hours}</span>}
              </div>
            )}

            {isRest && block.subtitle && (
              <p className="text-sm text-[var(--ink-2)] mt-1">{block.subtitle}</p>
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
          {editing ? (
            <WaypointTableEditor
              initial={waypoints ?? []}
              onSave={saveWaypoints}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <>
              {waypoints && waypoints.length > 0 && <WaypointTable waypoints={waypoints} />}

              {elevProfile && (
                <div className="h-12">
                  <ElevationProfile data={elevProfile} />
                </div>
              )}

              <WeatherStrip
                high={block.weather_high}
                low={block.weather_low}
                note={block.weather_note}
              />

              {block.hike_has_variant && block.hike_variant_note && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-sm text-purple-800">
                  <span className="font-medium">Variant: </span>
                  {block.hike_variant_note}
                </div>
              )}

              {block.booking_conf && (
                <p className="text-xs text-[var(--ink-3)]">
                  Ref: <span className="font-mono text-[var(--ink-2)]">{block.booking_conf}</span>
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
                    ? "View trail page"
                    : "Open trail page"}
                </a>
              )}

              <BlockThread
                blockId={block.id}
                tripId={block.trip_id}
                blockTitle={block.title}
                currentUserId={currentUserId}
                currentUserName={currentUserName}
                currentUserColor={currentUserColor}
              />
            </>
          )}
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
          onEditWaypoints={() => {
            setExpanded(true);
            setEditing(true);
          }}
        />
      )}
    </div>
  );
}
