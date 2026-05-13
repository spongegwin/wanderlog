export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return "";
  if (!end) return formatDate(start);
  const s = new Date(start);
  const e = new Date(end);
  const sMonth = s.toLocaleDateString("en-US", { month: "short" });
  const eMonth = e.toLocaleDateString("en-US", { month: "short" });
  if (sMonth === eMonth) {
    return `${sMonth} ${s.getDate()}–${e.getDate()}, ${e.getFullYear()}`;
  }
  return `${sMonth} ${s.getDate()} – ${eMonth} ${e.getDate()}, ${e.getFullYear()}`;
}

export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

const PARTICIPANT_COLORS = [
  "#c45c2e", "#4a7c59", "#3a6b8a", "#8b5e3c",
  "#7c4a7c", "#5a7c4a", "#3a5a8a", "#8a3a3a",
];

export function assignColor(index: number): string {
  return PARTICIPANT_COLORS[index % PARTICIPANT_COLORS.length];
}

// Google Maps universal search URL. Works on desktop browsers, opens the
// Google Maps app on Android, and on iOS opens Safari (or the Google Maps
// app if installed). Avoids platform branching while staying tappable.
export function mapUrl(location: string, contextHint?: string | null): string {
  const query = contextHint ? `${location}, ${contextHint}` : location;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
