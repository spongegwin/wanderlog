import type { ItineraryBlock } from "@/lib/types";
import StatusBadge from "@/components/ui/StatusBadge";

interface ItineraryPreviewProps {
  blocks: ItineraryBlock[];
}

const TYPE_ICON: Record<string, string> = {
  flight: "✈️",
  stay: "🏠",
  activity: "🎯",
  meal: "🍽️",
  transport: "🚗",
  hike: "🥾",
  rest: "🌿",
  idea: "💡",
};

function groupKey(b: ItineraryBlock): string {
  return b.date ?? b.day_label ?? "Unscheduled";
}

function groupLabel(key: string): string {
  if (key === "Unscheduled") return "Unscheduled";
  // ISO date?
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    return new Date(key + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }
  return key;
}

export default function ItineraryPreview({ blocks }: ItineraryPreviewProps) {
  if (blocks.length === 0) {
    return (
      <div className="mt-8">
        <h2 className="font-serif text-sm uppercase tracking-wider text-[var(--ink-3)] mb-3">
          Itinerary
        </h2>
        <p className="text-sm text-[var(--ink-3)] italic">No blocks yet.</p>
      </div>
    );
  }

  const groups = new Map<string, ItineraryBlock[]>();
  for (const b of blocks) {
    const k = groupKey(b);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(b);
  }

  const orderedKeys = Array.from(groups.keys()).sort((a, b) => {
    if (a === "Unscheduled") return 1;
    if (b === "Unscheduled") return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="mt-8">
      <h2 className="font-serif text-sm uppercase tracking-wider text-[var(--ink-3)] mb-3">
        Itinerary
      </h2>
      <div className="space-y-6">
        {orderedKeys.map((key) => {
          const items = groups.get(key)!;
          return (
            <div key={key}>
              <h3 className="text-sm font-medium text-[var(--ink-2)] mb-2">{groupLabel(key)}</h3>
              <ul className="space-y-2">
                {items.map((b) => (
                  <li
                    key={b.id}
                    className="bg-white border border-[var(--paper-3)] rounded-xl p-3 flex items-start gap-3"
                  >
                    <span className="text-lg leading-none mt-0.5">
                      {b.icon || TYPE_ICON[b.type] || "•"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-[var(--ink)] break-words">{b.title}</span>
                        <StatusBadge status={b.status} />
                      </div>
                      {b.subtitle && (
                        <p className="text-sm text-[var(--ink-3)] mt-0.5 break-words">{b.subtitle}</p>
                      )}
                      {(b.from_location || b.to_location) && (
                        <p className="text-xs text-[var(--ink-3)] mt-0.5">
                          {[b.from_location, b.to_location].filter(Boolean).join(" → ")}
                        </p>
                      )}
                      {(b.hike_distance || b.hike_elev_gain || b.hike_est_hours) && (
                        <p className="text-xs text-[var(--ink-3)] mt-0.5">
                          {[b.hike_distance, b.hike_elev_gain && `↑ ${b.hike_elev_gain}`, b.hike_est_hours]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                      {b.cost_amount != null && (
                        <p className="text-xs text-[var(--ink-3)] mt-0.5">
                          {b.cost_currency ?? "USD"} {b.cost_amount.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
