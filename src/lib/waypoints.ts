import type { HikeWaypoint } from "./types";

export function parseDuration(s: string): number {
  const trimmed = s.trim();
  const match = trimmed.match(/^(\d+):(\d{2})$/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

export function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

export function addTimeStr(time: string, mins: number): string {
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return time;
  const totalMins = parseInt(match[1], 10) * 60 + parseInt(match[2], 10) + mins;
  const h = Math.floor(totalMins / 60) % 24;
  const m = totalMins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function recalcWaypoints(waypoints: HikeWaypoint[]): HikeWaypoint[] {
  let cumDist = 0;
  let cumMins = 0;
  const startTime = waypoints[0]?.time ?? null;

  return waypoints.map((wp, i) => {
    const updated = { ...wp };

    if (!wp.is_break) {
      if (wp.dist_mi != null) {
        cumDist += wp.dist_mi;
      }
      updated.total_dist_mi = cumDist > 0 ? Math.round(cumDist * 100) / 100 : wp.total_dist_mi;
    }

    if (startTime && wp.duration) {
      const mins = parseDuration(wp.duration);
      if (i === 0) {
        updated.time = startTime;
      } else {
        updated.time = addTimeStr(startTime, cumMins);
      }
      if (!wp.is_break) {
        cumMins += mins;
      }
    }

    return updated;
  });
}

export function parseTSV(raw: string): HikeWaypoint[] {
  const lines = raw.split("\n").filter((l) => l.trim());
  const waypoints: HikeWaypoint[] = [];

  for (const line of lines) {
    const cols = line.split("\t");
    if (cols.length < 2) continue;

    const location = cols[0]?.trim() ?? "";
    if (!location) continue;

    const lowerLoc = location.toLowerCase();
    const isHeader =
      lowerLoc === "location" ||
      lowerLoc === "waypoint" ||
      lowerLoc === "point" ||
      lowerLoc === "name";
    if (isHeader) continue;

    const isBreak =
      lowerLoc.includes("break") ||
      lowerLoc.includes("lunch") ||
      lowerLoc.includes("rest") ||
      lowerLoc.includes("snack");

    const elevRaw = cols[1]?.trim() ?? "";
    const gainRaw = cols[2]?.trim() ?? "";
    const lossRaw = cols[3]?.trim() ?? "";
    const distRaw = cols[4]?.trim() ?? "";
    const totalRaw = cols[5]?.trim() ?? "";
    const durationRaw = cols[6]?.trim() ?? "";
    const timeRaw = cols[7]?.trim() ?? "";
    const escapeRaw = cols[8]?.trim() ?? "";
    const notesRaw = cols[9]?.trim() ?? "";

    const parseNum = (s: string) => {
      const n = parseFloat(s.replace(/,/g, ""));
      return isNaN(n) ? null : n;
    };

    waypoints.push({
      location,
      elevation_ft: parseNum(elevRaw),
      gain_ft: parseNum(gainRaw),
      loss_ft: parseNum(lossRaw),
      dist_mi: parseNum(distRaw),
      total_dist_mi: parseNum(totalRaw),
      duration: durationRaw || null,
      time: timeRaw || null,
      escape: escapeRaw || null,
      notes: notesRaw || null,
      is_break: isBreak,
    });
  }

  return waypoints;
}
