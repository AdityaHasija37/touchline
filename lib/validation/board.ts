import { z } from "zod";
import { MATCH_FORMATS, type MatchFormat } from "@/lib/domain/format";

/**
 * Board JSON v1 (TECH-003 §4). Typed and versioned, never a Konva node tree.
 * z.object() strips unknown keys, so whatever reaches the database is exactly this shape.
 */
export const BOARD_SCHEMA_VERSION = 1;
export const MAX_OBJECTS = 200;
export const MAX_TEXT = 240;

const coord = z.number().finite().min(0).max(100);
const point = z.object({ x: coord, y: coord });
const objectId = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);

export const playerObject = z.object({
  id: objectId,
  kind: z.literal("player"),
  playerId: z.uuid().nullable(),
  team: z.enum(["home", "away"]),
  label: z.string().trim().max(12),
  x: coord,
  y: coord,
});
export const ballObject = z.object({ id: objectId, kind: z.literal("ball"), x: coord, y: coord });
export const arrowObject = z.object({
  id: objectId,
  kind: z.literal("arrow"),
  from: point,
  to: point,
  style: z.enum(["run", "pass", "dribble"]),
});
export const lineObject = z.object({ id: objectId, kind: z.literal("line"), from: point, to: point });
export const zoneObject = z.object({
  id: objectId,
  kind: z.literal("zone"),
  x: coord,
  y: coord,
  w: coord,
  h: coord,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  label: z.string().trim().max(40).optional(),
});
export const textObject = z.object({ id: objectId, kind: z.literal("text"), x: coord, y: coord, text: z.string().trim().min(1).max(MAX_TEXT) });

export const boardObject = z.discriminatedUnion("kind", [playerObject, ballObject, arrowObject, lineObject, zoneObject, textObject]);

export const boardSchema = z
  .object({
    schemaVersion: z.literal(BOARD_SCHEMA_VERSION),
    format: z.union(MATCH_FORMATS.map((f) => z.literal(f)) as [z.ZodLiteral<5>, z.ZodLiteral<7>, z.ZodLiteral<11>]),
    orientation: z.enum(["vertical", "horizontal"]),
    objects: z.array(boardObject).max(MAX_OBJECTS),
  })
  .superRefine((b, ctx) => {
    const ids = new Set<string>();
    const players = new Set<string>();
    const count = { home: 0, away: 0 };
    let balls = 0;
    b.objects.forEach((o, i) => {
      if (ids.has(o.id)) ctx.addIssue({ code: "custom", path: ["objects", i, "id"], message: "Duplicate object id." });
      ids.add(o.id);
      if (o.kind === "ball") balls++;
      if (o.kind === "zone" && (o.x + o.w > 100.0001 || o.y + o.h > 100.0001)) {
        ctx.addIssue({ code: "custom", path: ["objects", i], message: "Zone extends beyond the pitch." });
      }
      if (o.kind !== "player") return;
      count[o.team]++;
      if (o.playerId) {
        if (players.has(o.playerId)) ctx.addIssue({ code: "custom", path: ["objects", i, "playerId"], message: "A player can only appear once on a board." });
        players.add(o.playerId);
      }
    });
    // TAC-01: a board never carries more markers per side than the format allows.
    if (count.home > b.format) ctx.addIssue({ code: "custom", path: ["objects"], message: `A ${b.format}v${b.format} board can have at most ${b.format} of your players.` });
    if (count.away > b.format) ctx.addIssue({ code: "custom", path: ["objects"], message: `A ${b.format}v${b.format} board can have at most ${b.format} opponents.` });
    if (balls > 1) ctx.addIssue({ code: "custom", path: ["objects"], message: "Only one ball per board." });
  });

export type Board = z.infer<typeof boardSchema>;
export type BoardObject = z.infer<typeof boardObject>;
export type PlayerMarker = z.infer<typeof playerObject>;

export const TACTIC_CATEGORIES = ["shape", "attacking", "defending", "set_piece", "other"] as const;
export type TacticCategory = (typeof TACTIC_CATEGORIES)[number];
export const CATEGORY_LABELS: Record<TacticCategory, string> = {
  shape: "Shape",
  attacking: "Attacking",
  defending: "Defending",
  set_piece: "Set piece",
  other: "Other",
};

export const tacticNameSchema = z
  .string()
  .trim()
  .min(1, "Give the tactic a name.")
  .max(60, "Names can be at most 60 characters.");

export function emptyBoard(format: MatchFormat): Board {
  return { schemaVersion: BOARD_SCHEMA_VERSION, format, orientation: "vertical", objects: [] };
}
