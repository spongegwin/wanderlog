interface WeatherStripProps {
  high: string | null;
  low: string | null;
  note: string | null;
}

export default function WeatherStrip({ high, low, note }: WeatherStripProps) {
  if (!high && !low && !note) return null;

  return (
    <div className="flex items-center gap-3 text-sm text-[var(--ink-2)] bg-[var(--paper-2)] rounded-lg px-3 py-2">
      <span>🌤</span>
      {(high || low) && (
        <span>
          {high && `↑${high}`}
          {high && low && " · "}
          {low && `↓${low}`}
        </span>
      )}
      {note && <span className="text-[var(--ink-3)]">{note}</span>}
    </div>
  );
}
