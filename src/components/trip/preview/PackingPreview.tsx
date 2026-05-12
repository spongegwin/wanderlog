import type { PackingItem } from "@/lib/types";

interface PackingPreviewProps {
  items: PackingItem[];
}

export default function PackingPreview({ items }: PackingPreviewProps) {
  if (items.length === 0) return null;

  const byCategory = new Map<string, PackingItem[]>();
  for (const item of items) {
    const cat = item.category || "Other";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(item);
  }

  return (
    <div className="mt-8">
      <h2 className="font-serif text-sm uppercase tracking-wider text-[var(--ink-3)] mb-3">
        Packing list
      </h2>
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
        {Array.from(byCategory.entries()).map(([cat, list]) => (
          <div key={cat}>
            <h3 className="text-xs font-medium text-[var(--ink-2)] mb-1">{cat}</h3>
            <ul className="text-sm text-[var(--ink)] space-y-0.5">
              {list.map((it) => (
                <li key={it.id} className={it.packed ? "line-through text-[var(--ink-3)]" : ""}>
                  {it.label}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
