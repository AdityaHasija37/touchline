import { describe, expect, it } from "vitest";
import { clamp, fitPitch, pitchAspect, roundPoint, toPitch, toScreen, type Orientation } from "@/lib/domain/pitch";

const size = { width: 340, height: 525 };
const hsize = { width: 525, height: 340 };

describe("pitch geometry (ADR-02)", () => {
  it("clamps to 0–100 and handles NaN", () => {
    expect(clamp(-5)).toBe(0);
    expect(clamp(140)).toBe(100);
    expect(clamp(Number.NaN)).toBe(0);
  });

  it.each<[Orientation, { width: number; height: number }]>([
    ["vertical", size],
    ["horizontal", hsize],
  ])("round-trips pitch ↔ screen in %s orientation", (o, s) => {
    for (const p of [{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 25.5, y: 74 }, { x: 50, y: 50 }]) {
      const back = roundPoint(toPitch(toScreen(p, s, o), s, o));
      expect(back).toEqual(p);
    }
  });

  it("puts our own goal at the bottom (vertical) and on the left (horizontal)", () => {
    expect(toScreen({ x: 50, y: 100 }, size, "vertical")).toEqual({ x: 170, y: 525 });
    expect(toScreen({ x: 50, y: 100 }, hsize, "horizontal")).toEqual({ x: 0, y: 170 });
  });

  it("clamps drags that leave the pitch", () => {
    expect(toPitch({ x: -40, y: 900 }, size, "vertical")).toEqual({ x: 0, y: 100 });
  });

  it("fits the pitch at a 68:105 aspect inside any container", () => {
    const v = fitPitch({ width: 1000, height: 600 }, "vertical", 20);
    expect(v.width / v.height).toBeCloseTo(pitchAspect("vertical"), 5);
    expect(v.height).toBe(560);
    expect(v.offsetX).toBeCloseTo((1000 - v.width) / 2);
    const h = fitPitch({ width: 600, height: 1000 }, "horizontal", 20);
    expect(h.width).toBe(560);
  });
});
