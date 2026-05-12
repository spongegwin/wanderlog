import type { BlockStatus, BlockType, ItineraryBlock } from "./types";

const VALID_STATUSES: BlockStatus[] = ["idea", "suggested", "confirmed", "completed"];
const VALID_TYPES: BlockType[] = [
  "flight", "stay", "activity", "meal", "transport", "hike", "rest", "idea",
];

export interface ParsedBlockLine {
  date: string | null; // ISO YYYY-MM-DD; null for "Unscheduled"
  status: BlockStatus;
  type: BlockType;
  title: string;
  day_label: string | null;
  sort_order: number;
}

export interface BlockDiff {
  toInsert: ParsedBlockLine[];
  toDelete: ItineraryBlock[];
  toUpdate: Array<{
    id: string;
    title: string;
    fields: { status?: BlockStatus; type?: BlockType };
  }>;
  toReorder: Array<{ id: string; title: string; sort_order: number }>;
}

function dateHeader(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function shortDayLabel(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Serialize blocks into canonical bulk-editor text.
 * Format: `- [status] type · title`
 * Day headers: `Mon May 18, 2026` or `Unscheduled`
 */
export function toText(blocks: ItineraryBlock[]): string {
  const groups = new Map<string | null, ItineraryBlock[]>();
  for (const b of blocks) {
    const k = b.date ?? null;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(b);
  }

  const dated = Array.from(groups.keys())
    .filter((k): k is string => k !== null)
    .sort();

  const lines: string[] = [];

  for (const date of dated) {
    const items = groups.get(date)!.slice().sort((a, b) => a.sort_order - b.sort_order);
    if (lines.length > 0) lines.push("");
    lines.push(dateHeader(date));
    for (const b of items) {
      lines.push(`- [${b.status}] ${b.type} · ${b.title}`);
    }
  }

  const unscheduled = groups.get(null);
  if (unscheduled && unscheduled.length > 0) {
    const items = unscheduled.slice().sort((a, b) => a.sort_order - b.sort_order);
    if (lines.length > 0) lines.push("");
    lines.push("Unscheduled");
    for (const b of items) {
      lines.push(`- [${b.status}] ${b.type} · ${b.title}`);
    }
  }

  return lines.join("\n");
}

function parseDateHeader(line: string): string | null {
  const trimmed = line.trim();
  // ISO YYYY-MM-DD prefix
  const isoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  // Try Date.parse — handles "Mon May 18, 2026", "May 18 2026", etc.
  const parsed = new Date(trimmed);
  if (
    !isNaN(parsed.getTime()) &&
    parsed.getFullYear() > 1990 &&
    parsed.getFullYear() < 2200
  ) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return null;
}

/**
 * Parse the canonical text back into structured block lines.
 * Tolerant: ignores blank lines and unrecognized junk.
 * Accepts loose item lines too — `- [status] title` (type defaults to "idea")
 * and `- title` (idea status, idea type) for ease of brain-dump input.
 */
export function fromText(raw: string): ParsedBlockLine[] {
  const items: ParsedBlockLine[] = [];
  let currentDate: string | null = null;
  // Per-day position counter; resets on every header change.
  const positionByDate = new Map<string | null, number>();
  const nextPos = (date: string | null) => {
    const n = positionByDate.get(date) ?? 0;
    positionByDate.set(date, n + 1);
    return n;
  };

  const lines = raw.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Item with status + type: "- [status] type · title"
    const fullMatch = trimmed.match(
      /^[-*•]\s*\[(idea|suggested|confirmed|completed)\]\s*(flight|stay|activity|meal|transport|hike|rest|idea)\s*[·•|:\-—–]\s*(.+)$/i
    );
    if (fullMatch) {
      const status = fullMatch[1].toLowerCase() as BlockStatus;
      const type = fullMatch[2].toLowerCase() as BlockType;
      const title = fullMatch[3].trim();
      if (title) {
        items.push({
          date: currentDate,
          status,
          type,
          title,
          day_label: currentDate ? shortDayLabel(currentDate) : null,
          sort_order: nextPos(currentDate),
        });
      }
      continue;
    }

    // Item with status only: "- [status] title" — type defaults to "idea"
    const statusOnly = trimmed.match(
      /^[-*•]\s*\[(idea|suggested|confirmed|completed)\]\s*(.+)$/i
    );
    if (statusOnly) {
      const status = statusOnly[1].toLowerCase() as BlockStatus;
      const title = statusOnly[2].trim();
      if (title) {
        items.push({
          date: currentDate,
          status,
          type: "idea",
          title,
          day_label: currentDate ? shortDayLabel(currentDate) : null,
          sort_order: nextPos(currentDate),
        });
      }
      continue;
    }

    // Bare item: "- title" — defaults to idea/idea
    const bare = trimmed.match(/^[-*•]\s+(.+)$/);
    if (bare) {
      const title = bare[1].trim();
      if (title) {
        items.push({
          date: currentDate,
          status: "idea",
          type: "idea",
          title,
          day_label: currentDate ? shortDayLabel(currentDate) : null,
          sort_order: nextPos(currentDate),
        });
      }
      continue;
    }

    // Header: "Unscheduled"
    if (/^unscheduled\b/i.test(trimmed)) {
      currentDate = null;
      continue;
    }

    // Otherwise try to parse as a date header
    const date = parseDateHeader(trimmed);
    if (date) {
      currentDate = date;
      continue;
    }

    // Skip unrecognized lines
  }

  return items;
}

/**
 * Smart diff: matches by (date or "unscheduled", lowercase title).
 * - Insert: in target, not in current
 * - Delete: in current, not in target
 * - Update: matching key, but status or type changed
 *
 * Renames or date-moves are delete+insert (acceptable v1; use BlockEditor
 * for surgical edits that preserve block_id, comments, votes, etc.).
 */
export function diff(current: ItineraryBlock[], target: ParsedBlockLine[]): BlockDiff {
  const key = (date: string | null, title: string) =>
    `${date ?? "unscheduled"}|${title.toLowerCase().trim()}`;

  const currentMap = new Map<string, ItineraryBlock>();
  for (const b of current) {
    currentMap.set(key(b.date, b.title), b);
  }

  const targetKeys = new Set<string>();
  const toInsert: ParsedBlockLine[] = [];
  const toUpdate: BlockDiff["toUpdate"] = [];
  const toReorder: BlockDiff["toReorder"] = [];

  for (const t of target) {
    const k = key(t.date, t.title);
    if (targetKeys.has(k)) continue;
    targetKeys.add(k);

    const existing = currentMap.get(k);
    if (!existing) {
      toInsert.push(t);
      continue;
    }
    const fields: { status?: BlockStatus; type?: BlockType } = {};
    if (existing.status !== t.status) fields.status = t.status;
    if (existing.type !== t.type) fields.type = t.type;
    if (Object.keys(fields).length > 0) {
      toUpdate.push({ id: existing.id, title: existing.title, fields });
    }
    if (existing.sort_order !== t.sort_order) {
      toReorder.push({ id: existing.id, title: existing.title, sort_order: t.sort_order });
    }
  }

  const toDelete = current.filter((b) => !targetKeys.has(key(b.date, b.title)));

  return { toInsert, toDelete, toUpdate, toReorder };
}

/**
 * Serialize a single day's blocks WITHOUT a date header.
 * Used by the per-day bulk editor — the modal already shows the day in its title.
 */
export function toTextSingleDay(blocks: ItineraryBlock[]): string {
  const sorted = blocks.slice().sort((a, b) => a.sort_order - b.sort_order);
  return sorted.map((b) => `- [${b.status}] ${b.type} · ${b.title}`).join("\n");
}

/**
 * Parse a single day's textarea — same line grammar as `fromText` but ignores
 * any date headers and stamps `forcedDate` on every parsed block.
 */
export function fromTextSingleDay(
  raw: string,
  forcedDate: string | null
): ParsedBlockLine[] {
  // Reuse the line-level parsing, then override the date on every item
  const lines = fromText(raw);
  const dayLabel = forcedDate ? shortDayLabel(forcedDate) : null;
  return lines.map((l) => ({
    ...l,
    date: forcedDate,
    day_label: dayLabel,
  }));
}

// Re-export type constants for callers that need to render or validate
export { VALID_STATUSES, VALID_TYPES };
