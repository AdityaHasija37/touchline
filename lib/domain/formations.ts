import type { MatchFormat } from "./format";
import { BOARD_SCHEMA_VERSION, type Board, type PlayerMarker } from "@/lib/validation/board";

/**
 * Preset formations (TAC-01). Vertical orientation: our goal is at y = 100, attacking upward.
 * Each slot is [label, x, y]. Every preset for a format has exactly `format` slots.
 */
type Slot = readonly [label: string, x: number, y: number];

export type Formation = { id: string; name: string; format: MatchFormat; slots: readonly Slot[] };

export const FORMATIONS: readonly Formation[] = [
  { id: "5-121", name: "1-2-1 diamond", format: 5, slots: [["GK", 50, 92], ["DF", 50, 72], ["LM", 22, 52], ["RM", 78, 52], ["ST", 50, 30]] },
  { id: "5-22", name: "2-2 box", format: 5, slots: [["GK", 50, 92], ["LB", 30, 70], ["RB", 70, 70], ["LF", 30, 38], ["RF", 70, 38]] },
  { id: "5-211", name: "2-1-1", format: 5, slots: [["GK", 50, 92], ["LB", 30, 72], ["RB", 70, 72], ["CM", 50, 52], ["ST", 50, 30]] },

  { id: "7-231", name: "2-3-1", format: 7, slots: [["GK", 50, 92], ["LB", 32, 74], ["RB", 68, 74], ["LM", 18, 52], ["CM", 50, 54], ["RM", 82, 52], ["ST", 50, 28]] },
  { id: "7-321", name: "3-2-1", format: 7, slots: [["GK", 50, 92], ["LB", 22, 74], ["CB", 50, 76], ["RB", 78, 74], ["LM", 34, 52], ["RM", 66, 52], ["ST", 50, 28]] },
  { id: "7-2121", name: "2-1-2-1", format: 7, slots: [["GK", 50, 92], ["LB", 32, 75], ["RB", 68, 75], ["DM", 50, 62], ["LM", 24, 46], ["RM", 76, 46], ["ST", 50, 26]] },

  {
    id: "11-442", name: "4-4-2", format: 11,
    slots: [["GK", 50, 93], ["LB", 14, 76], ["CB", 38, 79], ["CB", 62, 79], ["RB", 86, 76], ["LM", 14, 54], ["CM", 38, 56], ["CM", 62, 56], ["RM", 86, 54], ["ST", 38, 30], ["ST", 62, 30]],
  },
  {
    id: "11-433", name: "4-3-3", format: 11,
    slots: [["GK", 50, 93], ["LB", 14, 76], ["CB", 38, 79], ["CB", 62, 79], ["RB", 86, 76], ["CM", 30, 56], ["DM", 50, 62], ["CM", 70, 56], ["LW", 18, 32], ["ST", 50, 26], ["RW", 82, 32]],
  },
  {
    id: "11-352", name: "3-5-2", format: 11,
    slots: [["GK", 50, 93], ["CB", 28, 78], ["CB", 50, 80], ["CB", 72, 78], ["LWB", 10, 56], ["CM", 32, 58], ["DM", 50, 64], ["CM", 68, 58], ["RWB", 90, 56], ["ST", 38, 30], ["ST", 62, 30]],
  },
];

export function formationsFor(format: MatchFormat): Formation[] {
  return FORMATIONS.filter((f) => f.format === format);
}

export function newObjectId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

/** Builds a fresh board from a preset (or a blank pitch when `formationId` is null). */
export function boardFromFormation(format: MatchFormat, formationId: string | null): Board {
  const objects: Board["objects"] = [];
  if (formationId) {
    const f = FORMATIONS.find((x) => x.id === formationId && x.format === format);
    if (!f) throw new Error(`Unknown ${format}v${format} formation: ${formationId}`);
    for (const [label, x, y] of f.slots) {
      const marker: PlayerMarker = { id: newObjectId("p"), kind: "player", playerId: null, team: "home", label, x, y };
      objects.push(marker);
    }
    objects.push({ id: newObjectId("ball"), kind: "ball", x: 50, y: 50 });
  }
  return { schemaVersion: BOARD_SCHEMA_VERSION, format, orientation: "vertical", objects };
}
