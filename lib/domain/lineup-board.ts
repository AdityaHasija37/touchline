import type { MatchFormat } from "./format";
import { BOARD_SCHEMA_VERSION, type Board } from "@/lib/validation/board";

type PitchStarter = { key?: string; name: string; number: number | null; position: string | null; x?: number; y?: number };

/** "Sam Okafor" → "Okafor"; keeps captions short enough to sit under a marker. */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  const last = parts.length > 1 ? parts[parts.length - 1] : parts[0];
  return last.length > 12 ? `${last.slice(0, 11)}…` : last;
}

/**
 * The starting lineup as a board (enhancement 2), so the pitch view reuses the board renderer
 * on screen and in the PDF. Marker ids are the player keys, which lets "Find me" ring them.
 * Returns null unless every starter has formation coordinates.
 */
export function lineupBoard(starters: PitchStarter[], format: MatchFormat): { board: Board; captions: Record<string, string> } | null {
  if (!starters.length || starters.some((s) => s.x === undefined || s.y === undefined)) return null;
  const captions: Record<string, string> = {};
  const objects = starters.map((s, i) => {
    const id = s.key ?? `p${i + 1}`;
    captions[id] = shortName(s.name);
    return { id, kind: "player" as const, playerId: null, team: "home" as const, label: s.number != null ? String(s.number) : (s.position ?? ""), x: s.x!, y: s.y! };
  });
  return { board: { schemaVersion: BOARD_SCHEMA_VERSION, format, orientation: "vertical", objects }, captions };
}
