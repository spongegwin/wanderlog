import type { PackingItem, PackingScope, Participant } from "./types";

const VALID_CATEGORIES = ["Gear", "Clothing", "Food", "Documents", "Other"] as const;
const VALID_SCOPES: PackingScope[] = ["shared", "personal"];

export interface ParsedItem {
  scope: PackingScope;
  category: string;
  label: string;
  assigneeName?: string | null;
}

export interface DiffResult {
  toInsert: ParsedItem[];
  toSoftDelete: PackingItem[];
  toUpdate: Array<{ id: string; assigned_to: string | null; oldLabel: string; newAssigneeName: string | null }>;
}

/**
 * Serialize the current packing list into the structured text format used by the bulk editor.
 */
export function toText(items: PackingItem[], participants: Participant[]): string {
  const byId = new Map(participants.map((p) => [p.id, p]));
  const lines: string[] = [];

  for (const scope of VALID_SCOPES) {
    for (const cat of VALID_CATEGORIES) {
      const items_in = items.filter(
        (i) => (i.scope ?? "shared") === scope && (i.category || "Other") === cat
      );
      if (items_in.length === 0) continue;

      if (lines.length > 0) lines.push("");
      lines.push(`${scope.toUpperCase()} · ${cat}`);
      for (const item of items_in) {
        const assignee = item.assigned_to ? byId.get(item.assigned_to) : null;
        if (scope === "shared" && assignee) {
          lines.push(`- ${item.label} — ${assignee.name ?? "?"}`);
        } else {
          lines.push(`- ${item.label}`);
        }
      }
    }
  }

  return lines.join("\n");
}

/**
 * Parse the structured text back into `ParsedItem[]`. Tolerant: ignores blank
 * lines and unrecognized junk.
 */
export function fromText(raw: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  let scope: PackingScope = "shared";
  let category: string = "Other";

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Item line first (so a `- SHARED · Gear` is treated as an item, not a header)
    const itemMatch = trimmed.match(/^[-*•]\s*(.+)$/);
    if (itemMatch) {
      const rest = itemMatch[1].trim();
      // Trailing assignee:  " — Name", " – Name", " - Name"
      const assigneeMatch = rest.match(/^(.+?)\s+[—–-]\s+([^—–\-]+)$/);
      if (assigneeMatch && scope === "shared") {
        items.push({
          scope,
          category,
          label: assigneeMatch[1].trim(),
          assigneeName: assigneeMatch[2].trim(),
        });
      } else {
        items.push({ scope, category, label: rest });
      }
      continue;
    }

    // Header line (no leading bullet)
    const headerMatch = trimmed.match(
      /^(SHARED|PERSONAL)\s*[·•:|\-–—]?\s*(Gear|Clothing|Food|Documents|Other)\s*$/i
    );
    if (headerMatch) {
      scope = headerMatch[1].toLowerCase() === "shared" ? "shared" : "personal";
      const catCandidate = headerMatch[2];
      category =
        VALID_CATEGORIES.find((c) => c.toLowerCase() === catCandidate.toLowerCase()) ??
        "Other";
      continue;
    }

    // Bare scope header ("SHARED" or "PERSONAL" alone)
    const scopeOnly = trimmed.match(/^(SHARED|PERSONAL)\s*$/i);
    if (scopeOnly) {
      scope = scopeOnly[1].toLowerCase() === "shared" ? "shared" : "personal";
      continue;
    }

    // Bare category header
    const catOnly = trimmed.match(/^(Gear|Clothing|Food|Documents|Other)\s*:?\s*$/i);
    if (catOnly) {
      category =
        VALID_CATEGORIES.find((c) => c.toLowerCase() === catOnly[1].toLowerCase()) ??
        "Other";
      continue;
    }

    // Unrecognized — skip
  }

  return items;
}

/**
 * Smart diff: matches by (scope, category, lowercase-label). Items in target
 * but not current become inserts; current but not target become soft-deletes;
 * matching items with a different assignee become updates.
 */
export function diff(
  current: PackingItem[],
  target: ParsedItem[],
  participants: Participant[]
): DiffResult {
  const key = (scope: string, cat: string, label: string) =>
    `${scope}|${cat}|${label.toLowerCase().trim()}`;

  const currentMap = new Map<string, PackingItem>();
  for (const item of current) {
    currentMap.set(key(item.scope ?? "shared", item.category || "Other", item.label), item);
  }

  const targetKeys = new Set<string>();
  const toInsert: ParsedItem[] = [];
  const toUpdate: DiffResult["toUpdate"] = [];

  for (const t of target) {
    const k = key(t.scope, t.category, t.label);
    if (targetKeys.has(k)) continue; // duplicate within target — skip
    targetKeys.add(k);

    const existing = currentMap.get(k);
    if (!existing) {
      toInsert.push(t);
      continue;
    }

    // Match assignee by name (case-insensitive) — only for shared items
    const expectedAssignee =
      t.scope === "shared" && t.assigneeName
        ? participants.find(
            (p) => (p.name ?? "").toLowerCase() === t.assigneeName!.toLowerCase()
          )?.id ?? null
        : null;

    if (existing.assigned_to !== expectedAssignee) {
      toUpdate.push({
        id: existing.id,
        assigned_to: expectedAssignee,
        oldLabel: existing.label,
        newAssigneeName: t.assigneeName ?? null,
      });
    }
  }

  const toSoftDelete = current.filter((item) => {
    const k = key(item.scope ?? "shared", item.category || "Other", item.label);
    return !targetKeys.has(k);
  });

  return { toInsert, toSoftDelete, toUpdate };
}
