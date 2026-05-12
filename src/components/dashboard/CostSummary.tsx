import type { ItineraryBlock } from "@/lib/types";

interface CostSummaryProps {
  blocks: ItineraryBlock[];
  participants: number;
}

export default function CostSummary({ blocks, participants }: CostSummaryProps) {
  const blocksWithCost = blocks.filter((b) => b.cost_amount);

  const byCurrency: Record<string, { confirmed: number; estimated: number }> = {};
  for (const b of blocksWithCost) {
    const cur = b.cost_currency ?? "USD";
    if (!byCurrency[cur]) byCurrency[cur] = { confirmed: 0, estimated: 0 };
    if (b.status === "confirmed" || b.status === "completed") {
      byCurrency[cur].confirmed += b.cost_amount!;
    } else {
      byCurrency[cur].estimated += b.cost_amount!;
    }
  }

  const byType: Record<string, number> = {};
  for (const b of blocksWithCost) {
    byType[b.type] = (byType[b.type] ?? 0) + (b.cost_amount ?? 0);
  }

  if (blocksWithCost.length === 0) {
    return (
      <div className="text-sm text-[var(--ink-3)] py-4 text-center">
        No costs added yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(byCurrency).map(([cur, { confirmed, estimated }]) => (
        <div key={cur} className="bg-white border border-[var(--paper-3)] rounded-xl p-4">
          <div className="flex justify-between items-baseline mb-3">
            <span className="font-serif text-lg font-semibold text-[var(--ink)]">
              {cur} {(confirmed + estimated).toLocaleString()}
            </span>
            {participants > 1 && (
              <span className="text-sm text-[var(--ink-3)]">
                ≈ {cur} {Math.ceil((confirmed + estimated) / participants).toLocaleString()} / person
              </span>
            )}
          </div>
          <div className="flex gap-4 text-sm">
            <div>
              <p className="text-xs text-[var(--ink-3)]">Confirmed</p>
              <p className="font-medium text-emerald-700">{cur} {confirmed.toLocaleString()}</p>
            </div>
            {estimated > 0 && (
              <div>
                <p className="text-xs text-[var(--ink-3)]">Estimated</p>
                <p className="font-medium text-amber-700">{cur} {estimated.toLocaleString()}</p>
              </div>
            )}
          </div>
        </div>
      ))}

      <div>
        <p className="text-xs font-medium text-[var(--ink-3)] uppercase tracking-wide mb-2">
          By category
        </p>
        <div className="space-y-1">
          {Object.entries(byType).map(([type, amount]) => (
            <div key={type} className="flex justify-between text-sm">
              <span className="capitalize text-[var(--ink-2)]">{type}</span>
              <span className="text-[var(--ink)]">{amount.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
