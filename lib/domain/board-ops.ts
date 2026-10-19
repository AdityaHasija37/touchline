import { clamp, roundPoint, type Orientation, type PitchPoint } from "./pitch";
import { newObjectId } from "./formations";
import type { Board, BoardObject, PlayerMarker } from "@/lib/validation/board";

/**
 * Pure, serialisable editor operations. Every edit goes through `applyOp`, which keeps
 * mutations deterministic and gives Phase 3 undo/redo a single place to hook into.
 */
export type BoardOp =
  | { type: "move"; id: string; to: PitchPoint }
  | { type: "nudge"; id: string; dx: number; dy: number }
  | { type: "add-player"; team: "home" | "away"; at?: PitchPoint }
  | { type: "add-ball"; at?: PitchPoint }
  | { type: "remove"; id: string }
  | { type: "assign"; id: string; playerId: string | null; label: string }
  | { type: "relabel"; id: string; label: string }
  | { type: "orientation"; orientation: Orientation };

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
  }
}
