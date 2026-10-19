/**
 * Pitch geometry (ADR-02, DEC-12).
 *
 * Pitch space is 0–100 on both axes, defined for the vertical orientation:
 * x runs touchline to touchline (left → right), y runs from the far goal (0) to
 * our own goal (100). Horizontal rendering rotates this so our goal is on the left.
 * One x unit is not the same physical length as one y unit; the pitch is 68 × 105.
 */
export type Orientation = "vertical" | "horizontal";
export type PitchPoint = { x: number; y: number };
export type ScreenPoint = { x: number; y: number };
export type Viewport = { width: number; height: number; padding: number };

export const PITCH_WIDTH_M = 68;
export const PITCH_LENGTH_M = 105;

export function clamp(n: number, min = 0, max = 100): number {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function clampPoint(p: PitchPoint): PitchPoint {
  return { x: clamp(p.x), y: clamp(p.y) };
}

/** Round to 0.1 so saved geometry is stable and diff-friendly. */
export function roundPoint(p: PitchPoint): PitchPoint {
  return { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 };
}

/** Aspect ratio (width / height) of the drawn pitch for an orientation. */
export function pitchAspect(orientation: Orientation): number {
  return orientation === "vertical" ? PITCH_WIDTH_M / PITCH_LENGTH_M : PITCH_LENGTH_M / PITCH_WIDTH_M;
}

/** Largest pitch rectangle (in px) that fits the container at the right aspect, centred. */
export function fitPitch(container: { width: number; height: number }, orientation: Orientation, padding = 16): Viewport & {
  offsetX: number;
  offsetY: number;
} {
  const aspect = pitchAspect(orientation);
  const availW = Math.max(0, container.width - padding * 2);
  const availH = Math.max(0, container.height - padding * 2);
  let width = availW;
  let height = width / aspect;
  if (height > availH) {
    height = availH;
    width = height * aspect;
  }
  return {
    width,
    height,
    padding,
    offsetX: (container.width - width) / 2,
    offsetY: (container.height - height) / 2,
  };
}

/** Pitch space → pixels inside the pitch rectangle (origin at its top-left). */
export function toScreen(p: PitchPoint, size: { width: number; height: number }, orientation: Orientation): ScreenPoint {
  if (orientation === "vertical") {
    return { x: (p.x / 100) * size.width, y: (p.y / 100) * size.height };
  }
  // Rotate 90° clockwise: own goal (y = 100) on the left, left touchline (x = 0) at the top.
  return { x: ((100 - p.y) / 100) * size.width, y: (p.x / 100) * size.height };
}

/** Pixels inside the pitch rectangle → pitch space, clamped to [0, 100]. */
export function toPitch(s: ScreenPoint, size: { width: number; height: number }, orientation: Orientation): PitchPoint {
  if (size.width <= 0 || size.height <= 0) return { x: 50, y: 50 };
  if (orientation === "vertical") {
    return clampPoint({ x: (s.x / size.width) * 100, y: (s.y / size.height) * 100 });
  }
  return clampPoint({ x: (s.y / size.height) * 100, y: 100 - (s.x / size.width) * 100 });
}
