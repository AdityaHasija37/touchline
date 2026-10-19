/** Supported match formats (PRD D-01). 9v9 is deferred. */
export const MATCH_FORMATS = [5, 7, 11] as const;

export type MatchFormat = (typeof MATCH_FORMATS)[number];

export function isMatchFormat(value: unknown): value is MatchFormat {
  return MATCH_FORMATS.includes(value as MatchFormat);
}

/** Starters required to publish a plan equals the format (MATCH-02, PRD §6). */
export function startersRequired(format: MatchFormat): number {
  return format;
}

export function formatLabel(format: MatchFormat): string {
  return `${format}v${format}`;
}
