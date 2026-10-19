import { clamp, roundPoint, type Orientation, type PitchPoint } from "./pitch";
import { newObjectId } from "./formations";
import { MAX_OBJECTS, MAX_TEXT, type Board, type BoardObject, type PlayerMarker } from "@/lib/validation/board";

/**
 * Pure, serialisable editor operations. Every edit goes through `applyOp`, which keeps
 * mutations deterministic and gives undo/redo (lib/domain/history.ts) a single place to hook into.
 */
export type ArrowStyle = "run" | "pass" | "dribble";

export const ZONE_COLORS = ["#facc15", "#38bdf8", "#f87171", "#a78bfa", "#ffffff"] as const;
export const MIN_SEGMENT = 2; // pitch units; shorter drags are treated as clicks
export const MIN_ZONE = 3;

export type BoardOp =
  | { type: "move"; id: string; to: PitchPoint }
  | { type: "nudge"; id: string; dx: number; dy: number }
  | { type: "add-player"; team: "home" | "away"; at?: PitchPoint }
  | { type: "add-ball"; at?: PitchPoint }
  | { type: "remove"; id: string }
  | { type: "assign"; id: string; playerId: string | null; label: string }
  | { type: "relabel"; id: string; label: string }
  | { type: "orientation"; orientation: Orientation }
  | { type: "add-arrow"; from: PitchPoint; to: PitchPoint; style: ArrowStyle }
  | { type: "add-line"; from: PitchPoint; to: PitchPoint }
  | { type: "set-endpoint"; id: string; end: "from" | "to"; to: PitchPoint }
  | { type: "set-arrow-style"; id: string; style: ArrowStyle }
  | { type: "add-zone"; a: PitchPoint; b: PitchPoint; color?: string }
  | { type: "set-zone-rect"; id: string; a: PitchPoint; b: PitchPoint }
  | { type: "update-zone"; id: string; label?: string; color?: string }
  | { type: "add-text"; at: PitchPoint; text: string }
  | { type: "edit-text"; id: string; text: string };

export class BoardOpError extends Error {}

export function countMarkers(board: Board, team: "home" | "away"): number {
  return board.objects.filter((o) => o.kind === "player" && o.team === team).length;
}

function mapObject(board: Board, id: string, fn: (o: BoardObject) => BoardObject): Board {
  let found = false;
  const objects = board.objects.map((o) => {
    if (o.id !== id) return o;
    found = true;
    return fn(o);
  });
  if (!found) throw new BoardOpError(`No object ${id}`);
  return { ...board, objects };
}

/** Only position fields change on a move: playerId, team and label are untouched (TAC-02). */
function moveObject(o: BoardObject, to: PitchPoint): BoardObject {
  const p = roundPoint({ x: clamp(to.x), y: clamp(to.y) });
  switch (o.kind) {
    case "player":
    case "ball":
    case "text":
      return { ...o, x: p.x, y: p.y };
    case "zone":
      return { ...o, x: Math.min(p.x, 100 - o.w), y: Math.min(p.y, 100 - o.h) };
    case "arrow":
    case "line": {
      // Translate the whole segment, keeping it on the pitch.
      const dx = p.x - o.from.x;
      const dy = p.y - o.from.y;
      const minX = Math.min(o.from.x, o.to.x), maxX = Math.max(o.from.x, o.to.x);
      const minY = Math.min(o.from.y, o.to.y), maxY = Math.max(o.from.y, o.to.y);
      const cdx = clamp(dx, -minX, 100 - maxX);
      const cdy = clamp(dy, -minY, 100 - maxY);
      const shift = (q: PitchPoint) => roundPoint({ x: q.x + cdx, y: q.y + cdy });
      return { ...o, from: shift(o.from), to: shift(o.to) };
    }
  }
}

function anchor(o: BoardObject): PitchPoint {
  return o.kind === "arrow" || o.kind === "line" ? o.from : { x: o.x, y: o.y };
}

const cp = (p: PitchPoint) => roundPoint({ x: clamp(p.x), y: clamp(p.y) });
const dist = (a: PitchPoint, b: PitchPoint) => Math.hypot(a.x - b.x, a.y - b.y);

/** Normalise two corners into a clamped rectangle of at least MIN_ZONE per side. */
function zoneRect(a: PitchPoint, b: PitchPoint) {
  const p = cp(a), q = cp(b);
  const x = Math.min(p.x, q.x), y = Math.min(p.y, q.y);
  const w = Math.abs(p.x - q.x), h = Math.abs(p.y - q.y);
  if (w < MIN_ZONE || h < MIN_ZONE) throw new BoardOpError("Zones need to be a little bigger.");
  return { x, y, w: Math.round(w * 10) / 10, h: Math.round(h * 10) / 10 };
}

function guardCapacity(board: Board) {
  if (board.objects.length >= MAX_OBJECTS) throw new BoardOpError(`A board can hold at most ${MAX_OBJECTS} items.`);
}

function cleanText(text: string): string {
  const t = text.trim();
  if (!t) throw new BoardOpError("Text can't be empty.");
  if (t.length > MAX_TEXT) throw new BoardOpError(`Text can be at most ${MAX_TEXT} characters.`);
  return t;
}

export function applyOp(board: Board, op: BoardOp): Board {
  switch (op.type) {
    case "move":
      return mapObject(board, op.id, (o) => moveObject(o, op.to));
    case "nudge":
      return mapObject(board, op.id, (o) => {
        const a = anchor(o);
        return moveObject(o, { x: a.x + op.dx, y: a.y + op.dy });
      });
    case "add-player": {
      if (countMarkers(board, op.team) >= board.format) {
        throw new BoardOpError(
          op.team === "home"
            ? `A ${board.format}v${board.format} board already has ${board.format} of your players.`
            : `A ${board.format}v${board.format} board already has ${board.format} opponents.`,
        );
      }
      const at = roundPoint(op.at ?? { x: 50, y: op.team === "home" ? 66 : 34 });
      const n = countMarkers(board, op.team) + 1;
      const marker: PlayerMarker = {
        id: newObjectId(op.team === "home" ? "p" : "o"),
        kind: "player",
        playerId: null,
        team: op.team,
        label: op.team === "home" ? String(n) : `O${n}`,
        x: clamp(at.x),
        y: clamp(at.y),
      };
      return { ...board, objects: [...board.objects, marker] };
    }
    case "add-ball": {
      if (board.objects.some((o) => o.kind === "ball")) throw new BoardOpError("This board already has a ball.");
      const at = roundPoint(op.at ?? { x: 50, y: 50 });
      return { ...board, objects: [...board.objects, { id: newObjectId("ball"), kind: "ball", x: at.x, y: at.y }] };
    }
    case "remove":
      if (!board.objects.some((o) => o.id === op.id)) throw new BoardOpError(`No object ${op.id}`);
      return { ...board, objects: board.objects.filter((o) => o.id !== op.id) };
    case "assign": {
      if (op.playerId && board.objects.some((o) => o.kind === "player" && o.id !== op.id && o.playerId === op.playerId)) {
        throw new BoardOpError("That player is already on this board.");
      }
      return mapObject(board, op.id, (o) => {
        if (o.kind !== "player" || o.team !== "home") throw new BoardOpError("Only your own markers can be linked to squad players.");
        return { ...o, playerId: op.playerId, label: op.label.slice(0, 12) };
      });
    }
    case "relabel":
      return mapObject(board, op.id, (o) => {
        if (o.kind !== "player") throw new BoardOpError("Only player markers have labels.");
        return { ...o, label: op.label.trim().slice(0, 12) };
      });
    case "orientation":
      return { ...board, orientation: op.orientation };
    case "add-arrow":
    case "add-line": {
      guardCapacity(board);
      const from = cp(op.from), to = cp(op.to);
      if (dist(from, to) < MIN_SEGMENT) throw new BoardOpError("Drag a little further to draw.");
      const o: BoardObject =
        op.type === "add-arrow"
          ? { id: newObjectId("arrow"), kind: "arrow", from, to, style: op.style }
          : { id: newObjectId("line"), kind: "line", from, to };
      return { ...board, objects: [...board.objects, o] };
    }
    case "set-endpoint":
      return mapObject(board, op.id, (o) => {
        if (o.kind !== "arrow" && o.kind !== "line") throw new BoardOpError("Only arrows and lines have endpoints.");
        const next = { ...o, [op.end]: cp(op.to) };
        if (dist(next.from, next.to) < MIN_SEGMENT) throw new BoardOpError("Arrows need some length.");
        return next;
      });
    case "set-arrow-style":
      return mapObject(board, op.id, (o) => {
        if (o.kind !== "arrow") throw new BoardOpError("Only arrows have a style.");
        return { ...o, style: op.style };
      });
    case "add-zone": {
      guardCapacity(board);
      const color = op.color ?? ZONE_COLORS[0];
      return { ...board, objects: [...board.objects, { id: newObjectId("zone"), kind: "zone", ...zoneRect(op.a, op.b), color }] };
    }
    case "set-zone-rect":
      return mapObject(board, op.id, (o) => {
        if (o.kind !== "zone") throw new BoardOpError("Only zones can be resized.");
        return { ...o, ...zoneRect(op.a, op.b) };
      });
    case "update-zone":
      return mapObject(board, op.id, (o) => {
        if (o.kind !== "zone") throw new BoardOpError("Not a zone.");
        const label = op.label === undefined ? o.label : op.label.trim().slice(0, 40) || undefined;
        const color = op.color && /^#[0-9a-fA-F]{6}$/.test(op.color) ? op.color : o.color;
        const next = { ...o, color, label };
        if (next.label === undefined) delete next.label;
        return next;
      });
    case "add-text": {
      guardCapacity(board);
      return { ...board, objects: [...board.objects, { id: newObjectId("text"), kind: "text", ...cp(op.at), text: cleanText(op.text) }] };
    }
    case "edit-text":
      return mapObject(board, op.id, (o) => {
        if (o.kind !== "text") throw new BoardOpError("Not a text item.");
        return { ...o, text: cleanText(op.text) };
      });
  }
}
