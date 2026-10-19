import { describe, expect, it } from "vitest";
import { applyOp, BoardOpError, ZONE_COLORS } from "@/lib/domain/board-ops";
import { boardSchema, emptyBoard, type Board } from "@/lib/validation/board";

const last = (b: Board) => b.objects[b.objects.length - 1];

describe("drawing tools (TAC-02)", () => {
  it("adds arrows with a style and lines, clamped and rounded", () => {
    let b = applyOp(emptyBoard(7), { type: "add-arrow", from: { x: 45, y: 55 }, to: { x: 65.04, y: 38 }, style: "run" });
    expect(last(b)).toMatchObject({ kind: "arrow", from: { x: 45, y: 55 }, to: { x: 65, y: 38 }, style: "run" });
    b = applyOp(b, { type: "add-line", from: { x: -10, y: 50 }, to: { x: 20, y: 120 } });
    expect(last(b)).toMatchObject({ kind: "line", from: { x: 0, y: 50 }, to: { x: 20, y: 100 } });
    expect(boardSchema.safeParse(b).success).toBe(true);
  });

  it("treats tiny drags as clicks, not segments", () => {
    expect(() => applyOp(emptyBoard(7), { type: "add-arrow", from: { x: 50, y: 50 }, to: { x: 51, y: 50.5 }, style: "pass" })).toThrow(BoardOpError);
  });

  it("edits endpoints and style without touching the other end", () => {
    let b = applyOp(emptyBoard(7), { type: "add-arrow", from: { x: 10, y: 10 }, to: { x: 30, y: 30 }, style: "pass" });
    const id = last(b).id;
    b = applyOp(b, { type: "set-endpoint", id, end: "to", to: { x: 80, y: 5 } });
    b = applyOp(b, { type: "set-arrow-style", id, style: "dribble" });
    expect(last(b)).toEqual({ id, kind: "arrow", from: { x: 10, y: 10 }, to: { x: 80, y: 5 }, style: "dribble" });
  });

  it("moving an arrow translates both ends and stays on the pitch", () => {
    let b = applyOp(emptyBoard(7), { type: "add-arrow", from: { x: 10, y: 10 }, to: { x: 30, y: 40 }, style: "pass" });
    b = applyOp(b, { type: "move", id: last(b).id, to: { x: 90, y: 90 } });
    expect(last(b)).toMatchObject({ from: { x: 80, y: 70 }, to: { x: 100, y: 100 } });
  });

  it("normalises zones from any drag direction and enforces a minimum size", () => {
    let b = applyOp(emptyBoard(5), { type: "add-zone", a: { x: 60, y: 40 }, b: { x: 20, y: 10 } });
    expect(last(b)).toMatchObject({ kind: "zone", x: 20, y: 10, w: 40, h: 30, color: ZONE_COLORS[0] });
    expect(() => applyOp(b, { type: "add-zone", a: { x: 5, y: 5 }, b: { x: 6, y: 30 } })).toThrow(BoardOpError);
    const id = last(b).id;
    b = applyOp(b, { type: "set-zone-rect", id, a: { x: 20, y: 10 }, b: { x: 120, y: 50 } });
    expect(last(b)).toMatchObject({ x: 20, y: 10, w: 80, h: 40 });
    b = applyOp(b, { type: "update-zone", id, label: "  Press here ", color: "#38bdf8" });
    expect(last(b)).toMatchObject({ label: "Press here", color: "#38bdf8" });
    b = applyOp(b, { type: "update-zone", id, label: "" });
    expect(last(b)).not.toHaveProperty("label");
    expect(boardSchema.safeParse(b).success).toBe(true);
  });

  it("text is trimmed, required and capped at 240 characters", () => {
    let b = applyOp(emptyBoard(11), { type: "add-text", at: { x: 50, y: 20 }, text: "  Press their left back  " });
    expect(last(b)).toMatchObject({ kind: "text", text: "Press their left back", x: 50, y: 20 });
    expect(() => applyOp(b, { type: "edit-text", id: last(b).id, text: "   " })).toThrow(BoardOpError);
    expect(() => applyOp(b, { type: "edit-text", id: last(b).id, text: "x".repeat(241) })).toThrow(BoardOpError);
    b = applyOp(b, { type: "edit-text", id: last(b).id, text: "x".repeat(240) });
    expect(boardSchema.safeParse(b).success).toBe(true);
  });

  it("type-specific ops refuse the wrong kind", () => {
    const b = applyOp(emptyBoard(7), { type: "add-ball" });
    const id = last(b).id;
    for (const op of [
      { type: "set-arrow-style", id, style: "run" },
      { type: "set-endpoint", id, end: "to", to: { x: 1, y: 1 } },
      { type: "edit-text", id, text: "hi" },
      { type: "update-zone", id, label: "x" },
    ] as const) {
      expect(() => applyOp(b, op)).toThrow(BoardOpError);
    }
  });
});
