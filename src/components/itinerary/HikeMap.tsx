"use client";

import dynamic from "next/dynamic";
import type { HikeWaypoint } from "@/lib/types";

const HikeMapClient = dynamic(() => import("./HikeMapClient"), {
  ssr: false,
  loading: () => (
    <div className="h-[260px] rounded-lg bg-[var(--paper-2)] flex items-center justify-center text-xs text-[var(--ink-3)]">
      Loading map…
    </div>
  ),
});

interface HikeMapProps {
  waypoints: HikeWaypoint[];
}

export default function HikeMap({ waypoints }: HikeMapProps) {
  const hasCoords = waypoints.some((wp) => wp.lat != null && wp.lon != null);
  if (!hasCoords) return null;
  return <HikeMapClient waypoints={waypoints} />;
}
