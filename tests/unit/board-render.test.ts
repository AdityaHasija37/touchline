import { describe, expect, it } from "vitest";
import { applyOp } from "@/lib/domain/board-ops";
import { renderBoard, PAD } from "@/lib/domain/board-render";
import { boardFromFormation } from "@/lib/domain/formations";
import { PITCH_LENGTH_M as L, PITCH_WIDTH_M as W } from "@/lib/domain/pitch";

const board = () => {
  let b = boardFromFormation(7, "7-231");
  b = applyOp(b, { type: "add-arrow", from: { x: 50, y: 54 }, to: { x: 50, y: 30 }, style: "run" });
  b = applyOp(b, { type: "add-zone", a: { x: 10, y: 10 }, b: { x: 40, y: 30 } });
  b = applyOp(b, { type: "update-zone", id: b.objects.at(-1)!.id, label: "Trap" });
  return applyOp(b, { type: "add-text", at: { x: 50, y: 80 }, text: "Keeper starts every build-up" });
};

describe("board render primitives (SVG/PDF parity source)", () => {
  it("is deterministic", () => {
    const b = board();
    expect(renderBoard(b, "#1d4ed8")).toEqual(renderBoard(b, "#1d4ed8"));
  });

  it("sizes the canvas to the pitch plus padding in either orientation", () => {
    const v = renderBoard(board(), "#111827");
    expect([v.width, v.height]).toEqual([W + 2 * PAD, L + 2 * PAD]);
    const h = renderBoard({ ...board(), orientation: "horizontal" }, "#111827");
    expect([h.width, h.height]).toEqual([L + 2 * PAD, W + 2 * PAD]);
  });

  it("puts our goalkeeper near the bottom (vertical) and the left (horizontal)", () => {
    const gk = (o: "vertical" | "horizontal") =>
      renderBoard({ ...board(), orientation: o }, "#111827").prims.find((p) => p.t === "circle" && p.r === 2.6)! as { cx: number; cy: number };
    expect(gk("vertical").cy).toBeGreaterThan(L * 0.85);
    expect(gk("horizontal").cx).toBeLessThan(L * 0.15);
  });

  it("draws arrows as a shaft plus an explicit triangle head, dashed for runs", () => {
    const prims = renderBoard(board(), "#111827").prims;
    const shaft = prims.find((p) => p.t === "line" && p.dash);
    expect(shaft).toMatchObject({ dash: [1.6, 1] });
    expect(prims.some((p) => p.t === "path" && p.d.endsWith("Z"))).toBe(true);
  });

  it("wraps notes and labels zones; hides labels on request", () => {
    const texts = renderBoard(board(), "#111827").prims.filter((p) => p.t === "text").map((p) => (p as { text: string }).text);
    expect(texts).toEqual(expect.arrayContaining(["Trap", "Keeper starts every", "build-up", "GK"]));
    const quiet = renderBoard(board(), "#111827", { showLabels: false }).prims.filter((p) => p.t === "text").map((p) => (p as { text: string }).text);
    expect(quiet).not.toContain("GK");
  });
});
