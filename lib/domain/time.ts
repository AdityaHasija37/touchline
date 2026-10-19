/**
 * Timezone-aware kickoffs (MATCH-01, DEC-09) using only Intl, no date library.
 * A kickoff is entered as a wall-clock date + time in an IANA zone and stored as UTC.
 */
export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Wall-clock parts of an instant in a zone. */
function partsIn(date: Date, tz: string) {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
}

/** Offset of `tz` from UTC at `date`, in minutes. */
function offsetMinutes(date: Date, tz: string): number {
  const p = partsIn(date, tz);
  const asUtc = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/**
 * Converts a wall-clock time in `tz` to a UTC Date. In the autumn "fall back" hour the earlier
 * instant is used; in the spring gap the time is moved forward by the gap, as most calendars do.
 */
export function zonedTimeToUtc(date: string, time: string, tz: string): Date {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  // The zone's offset just before and after any DST change near this time.
  const before = offsetMinutes(new Date(wall - 12 * 3600_000), tz);
  const after = offsetMinutes(new Date(wall + 12 * 3600_000), tz);
  const candidates = [...new Set([wall - before * 60000, wall - after * 60000])].sort((a, b) => a - b);
  const matching = candidates.filter((c) => {
    const p = partsIn(new Date(c), tz);
    return p.y === y && p.mo === mo && p.d === d && p.h === h && p.mi === mi;
  });
  // Repeated hour: earliest match. Spring gap: no match, so use the pre-change offset (moves forward).
  return new Date(matching[0] ?? wall - before * 60000);
}

/** UTC instant → wall-clock `YYYY-MM-DD` and `HH:MM` in `tz` (for edit forms). */
export function toZonedParts(iso: string, tz: string): { date: string; time: string } {
  const p = partsIn(new Date(iso), tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${p.y}-${pad(p.mo)}-${pad(p.d)}`, time: `${pad(p.h)}:${pad(p.mi)}` };
}

/** Deterministic kickoff label in the fixture's own zone, e.g. "Sat 25 Oct 2026, 14:00 BST". */
export function formatKickoff(iso: string, tz: string, opts: { withZone?: boolean; withYear?: boolean } = {}): string {
  const { withZone = true, withYear = true } = opts;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: withYear ? "numeric" : undefined,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: withZone ? "short" : undefined,
  }).format(new Date(iso));
}
