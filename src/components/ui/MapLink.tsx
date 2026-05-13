"use client";

import { mapUrl } from "@/lib/utils";

interface MapLinkProps {
  location: string | null | undefined;
  fallback?: string;
  contextHint?: string | null;
  className?: string;
  children?: React.ReactNode;
}

// Renders a location string as a tappable Google Maps link. Stops propagation
// so it doesn't trigger a parent's expand-on-click. Falls back to plain text
// when there's no location. If children are passed, they replace the default
// rendering (useful for chip-style icon + text).
export default function MapLink({
  location,
  fallback = "—",
  contextHint,
  className,
  children,
}: MapLinkProps) {
  if (!location) {
    return <span className={className}>{fallback}</span>;
  }
  return (
    <a
      href={mapUrl(location, contextHint)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={
        className ??
        "text-[var(--ink-2)] hover:text-[var(--accent)] hover:underline transition"
      }
      title={`Open ${location} in Google Maps`}
    >
      {children ?? location}
    </a>
  );
}
