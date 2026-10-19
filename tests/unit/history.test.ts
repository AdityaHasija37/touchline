import { describe, expect, it } from "vitest";
import { applyOp } from "@/lib/domain/board-ops";
import { boardFromFormation } from "@/lib/domain/formations";
import { HISTORY_LIMIT, canRedo, canUndo, createHistory, record, redo, undo } from "@/lib/domain/history";

describe("history (TAC-04)", () => {
  it("undo restores the previous board exactly, redo reapplies it", () => {
    const b0 = boardFromFormation(7, "7-231");
    const snapshot = structuredClone(b0);
    const b1 = applyOp(b0, { type: "move", id: b0.objects[0].id, to: { x: 10, y: 10 } });
    let h = record(createHistory(b0), b1);
    h = undo(h);
    expect(h.present).toBe(b0);
    expect(h.present).toEqual(snapshot);
    h = redo(h);
    expect(h.present).toBe(b1);
  });

  it("a new action after undo clears the redo branch", () => {
    let h = record(record(createHistory("a"), "b"), "c");
    h = undo(h);
    expect(canRedo(h)).toBe(true);
    h = record(h, "d");
    expect(canRedo(h)).toBe(false);
    expect(h.past).toEqual(["a", "b"]);
  });

  it("keeps only the last 30 actions", () => {
    let h = createHistory(0);
    for (let i = 1; i <= 45; i++) h = record(h, i);
    expect(h.past).toHaveLength(HISTORY_LIMIT);
    let undos = 0;
    while (canUndo(h)) {
      h = undo(h);
      undos++;
    }
    expect(undos).toBe(30);
    expect(h.present).toBe(15);
  });

  it("ignores no-ops and is safe at the ends", () => {
    const h = createHistory("x");
    expect(record(h, "x")).toBe(h);
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
    expect(canUndo(h)).toBe(false);
  });
});
