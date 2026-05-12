import type { Resource } from "@/lib/types";

interface ResourcesPreviewProps {
  resources: Resource[];
}

const CATEGORY_LABEL: Record<string, string> = {
  trail_map: "Trail map",
  guide: "Guide",
  booking: "Booking",
  community: "Community",
  other: "Other",
};

export default function ResourcesPreview({ resources }: ResourcesPreviewProps) {
  if (resources.length === 0) return null;
  return (
    <div className="mt-8">
      <h2 className="font-serif text-sm uppercase tracking-wider text-[var(--ink-3)] mb-3">
        Resources
      </h2>
      <ul className="space-y-2">
        {resources.map((r) => (
          <li key={r.id} className="text-sm">
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] hover:underline break-words"
            >
              {r.title || r.url}
            </a>
            {r.category && (
              <span className="ml-2 text-xs text-[var(--ink-3)] uppercase tracking-wider">
                {CATEGORY_LABEL[r.category] ?? r.category}
              </span>
            )}
            {r.description && (
              <p className="text-xs text-[var(--ink-3)] mt-0.5">{r.description}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
