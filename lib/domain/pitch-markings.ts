import { PITCH_LENGTH_M as L, PITCH_WIDTH_M as W } from "./pitch";

/**
 * Pitch markings in metres for the vertical orientation (68 wide × 105 long, origin top-left).
 * Shared by the SVG renderer and the Konva editor so both draw the same pitch.
 */
export type Marking =
  | { type: "rect"; x: number; y: number; w: number; h: number }
  | { type: "line"; x1: number; y1: number; x2: number; y2: number }
  | { type: "circle"; cx: number; cy: number; r: number }
  | { type: "dot"; cx: number; cy: number; r: number }
  | { type: "arc"; cx: number; cy: number; r: number; startDeg: number; sweepDeg: number };

const CX = W / 2;
const PA_W = 40.32, PA_D = 16.5, GA_W = 18.32, GA_D = 5.5, CIRCLE = 9.15, SPOT = 11;
// Penalty arc: the part of the 9.15 m circle around the spot that lies outside the box.
const ARC_HALF = (Math.acos((PA_D - SPOT) / CIRCLE) * 180) / Math.PI;

export const PITCH_MARKINGS: readonly Marking[] = [
  { type: "rect", x: 0, y: 0, w: W, h: L },
  { type: "line", x1: 0, y1: L / 2, x2: W, y2: L / 2 },
  { type: "circle", cx: CX, cy: L / 2, r: CIRCLE },
  { type: "dot", cx: CX, cy: L / 2, r: 0.4 },
  // Far end (top)
  { type: "rect", x: CX - PA_W / 2, y: 0, w: PA_W, h: PA_D },
  { type: "rect", x: CX - GA_W / 2, y: 0, w: GA_W, h: GA_D },
  { type: "dot", cx: CX, cy: SPOT, r: 0.4 },
  { type: "arc", cx: CX, cy: SPOT, r: CIRCLE, startDeg: 90 - ARC_HALF, sweepDeg: ARC_HALF * 2 },
  // Own end (bottom)
  { type: "rect", x: CX - PA_W / 2, y: L - PA_D, w: PA_W, h: PA_D },
  { type: "rect", x: CX - GA_W / 2, y: L - GA_D, w: GA_W, h: GA_D },
  { type: "dot", cx: CX, cy: L - SPOT, r: 0.4 },
  { type: "arc", cx: CX, cy: L - SPOT, r: CIRCLE, startDeg: 270 - ARC_HALF, sweepDeg: ARC_HALF * 2 },
];

/** SVG path for an arc marking (angles in degrees, 0° = +x, clockwise with y down). */
export function arcPath(m: Extract<Marking, { type: "arc" }>): string {
  const rad = (d: number) => (d * Math.PI) / 180;
  const p = (d: number) => [m.cx + m.r * Math.cos(rad(d)), m.cy + m.r * Math.sin(rad(d))].map((n) => n.toFixed(3)).join(" ");
  return `M ${p(m.startDeg)} A ${m.r} ${m.r} 0 ${m.sweepDeg > 180 ? 1 : 0} 1 ${p(m.startDeg + m.sweepDeg)}`;
}
