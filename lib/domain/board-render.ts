import { markerFill } from "./colors";
import { PITCH_LENGTH_M as L, PITCH_WIDTH_M as W } from "./pitch";
import { PITCH_MARKINGS, type Marking } from "./pitch-markings";
import { wrapText } from "./text-wrap";
import type { Board, BoardObject } from "@/lib/validation/board";

/**
 * Renderer-agnostic drawing of a board (TECH-003 §7). Produces flat primitives in final viewBox
 * coordinates (metres, rotation already applied, arrowheads as explicit triangles), so the
 * screen SVG and the PDF draw exactly the same shapes from one source.
 */
export type Prim =
  | { t: "rect"; x: number; y: number; w: number; h: number; fill?: string; fillOpacity?: number; stroke?: string; strokeWidth?: number }
  | { t: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string; strokeWidth: number; dash?: number[]; round?: boolean }
  | { t: "circle"; cx: number; cy: number; r: number; fill?: string; stroke?: string; strokeWidth?: number }
  | { t: "path"; d: string; fill?: string; stroke?: string; strokeWidth?: number }
  | { t: "text"; x: number; y: number; text: string; size: number; bold: boolean; fill: string; anchor: "start" | "middle" };

export const PITCH_COLORS = { grass: "#3f8f5a", stripe: "#3a8653", line: "#eef5f0", away: "#f8fafc", ball: "#ffffff", ink: "#111827" };
export const PAD = 3;

type Pt = { x: number; y: number };

export function renderBoard(board: Board, teamColor: string, opts: { showLabels?: boolean } = {}): { width: number; height: number; prims: Prim[] } {
  const showLabels = opts.showLabels ?? true;
  const vertical = board.orientation === "vertical";
  const width = (vertical ? W : L) + PAD * 2;
  const height = (vertical ? L : W) + PAD * 2;
  // Pitch metres (vertical layout) → final coordinates. Horizontal rotates 90° clockwise: our goal on the left.
  const p = (x: number, y: number): Pt => (vertical ? { x: x + PAD, y: y + PAD } : { x: L - y + PAD, y: x + PAD });
  const rect = (x: number, y: number, w: number, h: number) => {
    const a = p(x, y), b = p(x + w, y + h);
    return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
  };
  const m = (pt: { x: number; y: number }) => p((pt.x / 100) * W, (pt.y / 100) * L);
  const fill = markerFill(teamColor);
  const prims: Prim[] = [];

  prims.push({ t: "rect", x: 0, y: 0, w: width, h: height, fill: PITCH_COLORS.grass });
  for (let i = 0; i < 7; i++) prims.push({ t: "rect", ...rect(0, (i * L) / 7, W, L / 14), fill: PITCH_COLORS.stripe });
  for (const k of PITCH_MARKINGS) prims.push(marking(k, p, rect));

  const ordered = [...board.objects].sort((a, b) => Z[a.kind] - Z[b.kind]);
  for (const o of ordered) prims.push(...object(o, m, rect, fill, showLabels));
  return { width, height, prims };
}

const Z: Record<BoardObject["kind"], number> = { zone: 0, line: 1, arrow: 2, text: 3, player: 4, ball: 5 };
const LINE = { stroke: PITCH_COLORS.line, strokeWidth: 0.35 };
const r3 = (n: number) => Math.round(n * 1000) / 1000;

function marking(k: Marking, p: (x: number, y: number) => Pt, rect: (x: number, y: number, w: number, h: number) => { x: number; y: number; w: number; h: number }): Prim {
  switch (k.type) {
    case "rect":
      return { t: "rect", ...rect(k.x, k.y, k.w, k.h), ...LINE };
    case "line": {
      const a = p(k.x1, k.y1), b = p(k.x2, k.y2);
      return { t: "line", x1: a.x, y1: a.y, x2: b.x, y2: b.y, ...LINE };
    }
    case "circle": {
      const c = p(k.cx, k.cy);
      return { t: "circle", cx: c.x, cy: c.y, r: k.r, ...LINE };
    }
    case "dot": {
      const c = p(k.cx, k.cy);
      return { t: "circle", cx: c.x, cy: c.y, r: k.r, fill: PITCH_COLORS.line };
    }
    case "arc": {
      // Rotation preserves orientation, so only the endpoints move; the sweep flag stays the same.
      const rad = (d: number) => (d * Math.PI) / 180;
      const at = (d: number) => p(k.cx + k.r * Math.cos(rad(d)), k.cy + k.r * Math.sin(rad(d)));
      const a = at(k.startDeg), b = at(k.startDeg + k.sweepDeg);
      return { t: "path", d: `M ${r3(a.x)} ${r3(a.y)} A ${k.r} ${k.r} 0 ${k.sweepDeg > 180 ? 1 : 0} 1 ${r3(b.x)} ${r3(b.y)}`, ...LINE, fill: "none" };
    }
  }
}

function object(
  o: BoardObject,
  m: (pt: { x: number; y: number }) => Pt,
  rect: (x: number, y: number, w: number, h: number) => { x: number; y: number; w: number; h: number },
  teamFill: string,
  showLabels: boolean,
): Prim[] {
  switch (o.kind) {
    case "zone": {
      const r = rect((o.x / 100) * W, (o.y / 100) * L, (o.w / 100) * W, (o.h / 100) * L);
      const out: Prim[] = [{ t: "rect", ...r, fill: o.color, fillOpacity: 0.28, stroke: o.color, strokeWidth: 0.3 }];
      if (o.label && showLabels) out.push({ t: "text", x: r.x + 1, y: r.y + 3, text: o.label, size: 2.4, bold: true, fill: "#ffffff", anchor: "start" });
      return out;
    }
    case "line": {
      const a = m(o.from), b = m(o.to);
      return [{ t: "line", x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: "#ffffff", strokeWidth: 0.5, round: true }];
    }
    case "arrow": {
      const a = m(o.from), b = m(o.to);
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
      const head = 1.8, half = 0.9;
      // Shaft stops at the base of the head so dashes don't poke through the tip.
      const base = { x: b.x - ux * head, y: b.y - uy * head };
      const left = { x: base.x - uy * half, y: base.y + ux * half }, right = { x: base.x + uy * half, y: base.y - ux * half };
      return [
        {
          t: "line",
          x1: a.x,
          y1: a.y,
          x2: base.x,
          y2: base.y,
          stroke: "#ffffff",
          strokeWidth: 0.5,
          dash: o.style === "run" ? [1.6, 1] : o.style === "dribble" ? [0.4, 0.8] : undefined,
          round: true,
        },
        { t: "path", d: `M ${r3(b.x)} ${r3(b.y)} L ${r3(left.x)} ${r3(left.y)} L ${r3(right.x)} ${r3(right.y)} Z`, fill: "#ffffff" },
      ];
    }
    case "text": {
      const c = m(o);
      return wrapText(o.text).map((line, i) => ({ t: "text" as const, x: c.x, y: c.y + 2.6 * (0.9 + i * 1.15), text: line, size: 2.6, bold: true, fill: "#ffffff", anchor: "middle" as const }));
    }
    case "ball": {
      const c = m(o);
      return [{ t: "circle", cx: c.x, cy: c.y, r: 1.1, fill: PITCH_COLORS.ball, stroke: PITCH_COLORS.ink, strokeWidth: 0.3 }];
    }
    case "player": {
      const c = m(o);
      const home = o.team === "home";
      const out: Prim[] = [{ t: "circle", cx: c.x, cy: c.y, r: 2.6, fill: home ? teamFill : PITCH_COLORS.away, stroke: home ? "#ffffff" : PITCH_COLORS.ink, strokeWidth: 0.45 }];
      if (showLabels && o.label) {
        const size = o.label.length > 2 ? 1.7 : 2.2;
        out.push({ t: "text", x: c.x, y: c.y + size * 0.35, text: o.label, size, bold: true, fill: home ? "#ffffff" : PITCH_COLORS.ink, anchor: "middle" });
      }
      return out;
    }
  }
}
