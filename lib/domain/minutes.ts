/**
 * Substitution plan maths (enhancement 5): who is on the pitch when, and how many minutes each
 * player gets. Works on opaque keys so it serves both the plan editor (player ids) and the
 * published snapshot (pseudonymous keys).
 */
export type Sub = { minute: number; outKey: string; inKey: string };

export type MinutesResult = {
  minutes: Record<string, number>;
  /** Per-sub problem (index-aligned with the input order), or null if the sub is valid. */
  problems: (string | null)[];
  /** Players getting under the fair share. */
  short: string[];
};

export const DEFAULT_MATCH_LENGTH: Record<number, number> = { 5: 40, 7: 60, 11: 90 };
/** Grassroots fairness rule of thumb: everyone in the squad plays at least half the game. */
export const FAIR_SHARE = 0.5;

export function computeMinutes(starters: string[], bench: string[], subs: Sub[], length: number): MinutesResult {
  const onSince = new Map<string, number>(starters.map((k) => [k, 0]));
  const minutes: Record<string, number> = Object.fromEntries([...starters, ...bench].map((k) => [k, 0]));
  const squad = new Set([...starters, ...bench]);
  const problems: (string | null)[] = subs.map(() => null);

  const order = subs.map((s, i) => ({ ...s, i })).sort((a, b) => a.minute - b.minute || a.i - b.i);
  for (const s of order) {
    if (!Number.isInteger(s.minute) || s.minute <= 0 || s.minute >= length) problems[s.i] = `Minute must be between 1 and ${length - 1}.`;
    else if (!squad.has(s.outKey) || !squad.has(s.inKey)) problems[s.i] = "Both players must be in the match squad.";
    else if (s.outKey === s.inKey) problems[s.i] = "A player can't replace themselves.";
    else if (!onSince.has(s.outKey)) problems[s.i] = "The player coming off isn't on the pitch at that point.";
    else if (onSince.has(s.inKey)) problems[s.i] = "The player coming on is already on the pitch.";
    if (problems[s.i]) continue;
    minutes[s.outKey] += s.minute - onSince.get(s.outKey)!;
    onSince.delete(s.outKey);
    onSince.set(s.inKey, s.minute);
  }
  for (const [k, since] of onSince) minutes[k] += length - since;

  const short = [...squad].filter((k) => minutes[k] < length * FAIR_SHARE);
  return { minutes, problems, short };
}
