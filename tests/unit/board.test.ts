import { describe, expect, it } from "vitest";
import { applyOp, BoardOpError, countMarkers } from "@/lib/domain/board-ops";
import { FORMATIONS, boardFromFormation, formationsFor } from "@/lib/domain/formations";
import { MATCH_FORMATS } from "@/lib/domain/format";
import { boardSchema, emptyBoard, type Board } from "@/lib/validation/board";

const UUID_A = "6f1e2d3c-4b5a-4987-8a6b-5c4d3e2f1a0b";
const UUID_B = "7a1e2d3c-4b5a-4987-8a6b-5c4d3e2f1a0c";

describe("formations (TAC-01)", () => {
  it.each(MATCH_FORMATS)("every %iv preset places exactly that many own-team markers, in bounds", (format) => {
    const presets = formationsFor(format);
    expect(presets.length).toBeGreaterThanOrEqual(2);
    for (const f of presets) {
      const b = boardFromFormation(format, f.id);
      expect(countMarkers(b, "home"), f.id).toBe(format);
      expect(countMarkers(b, "away")).toBe(0);
      expect(boardSchema.safeParse(b).success, f.id).toBe(true);
    }
  });

  it("a 7v7 template never introduces 11 players", () => {
    expect(() => boardFromFormation(7, "11-442")).toThrow();
    expect(FORMATIONS.every((f) => f.slots.length === f.format)).toBe(true);
  });

  it("blank pitch has no objects", () => {
    expect(boardFromFormation(5, null).objects).toEqual([]);
  });
});

describe("boardSchema (TECH-003 §4)", () => {
  const base = (): Board => boardFromFormation(7, "7-231");

  it("strips unknown fields before persistence", () => {
    const b = base() as unknown as Record<string, unknown> & { objects: Record<string, unknown>[] };
    b.konvaNode = { attrs: {} };
    b.objects[0].fill = "red";
    const parsed = boardSchema.parse(b);
    expect(parsed).not.toHaveProperty("konvaNode");
    expect(parsed.objects[0]).not.toHaveProperty("fill");
  });

  it("rejects coordinates outside 0–100", () => {
    const b = base();
    (b.objects[0] as { x: number }).x = 101;
    expect(boardSchema.safeParse(b).success).toBe(false);
  });

  it("rejects more own markers than the format", () => {
    const b = boardFromFormation(11, "11-442");
    expect(boardSchema.safeParse({ ...b, format: 7 }).success).toBe(false);
  });

  it("rejects the same squad player twice, duplicate ids, two balls and long text", () => {
    const b = base();
    const [p1, p2] = b.objects as Extract<Board["objects"][number], { kind: "player" }>[];
    expect(boardSchema.safeParse({ ...b, objects: [{ ...p1, playerId: UUID_A }, { ...p2, playerId: UUID_A }] }).success).toBe(false);
    expect(boardSchema.safeParse({ ...b, objects: [p1, { ...p2, id: p1.id }] }).success).toBe(false);
    const ball = { id: "b1", kind: "ball", x: 1, y: 1 } as const;
    expect(boardSchema.safeParse({ ...b, objects: [ball, { ...ball, id: "b2" }] }).success).toBe(false);
    expect(boardSchema.safeParse({ ...b, objects: [{ id: "t", kind: "text", x: 1, y: 1, text: "x".repeat(241) }] }).success).toBe(false);
  });

  it("rejects unknown schema versions and object kinds", () => {
    expect(boardSchema.safeParse({ ...base(), schemaVersion: 2 }).success).toBe(false);
    expect(boardSchema.safeParse({ ...base(), objects: [{ id: "x", kind: "cone", x: 1, y: 1 }] }).success).toBe(false);
  });
});

describe("board operations (TAC-02)", () => {
  const withAssigned = () => {
    const b = boardFromFormation(7, "7-231");
    const id = b.objects[0].id;
    return { id, b: applyOp(b, { type: "assign", id, playerId: UUID_A, label: "1" }) };
  };

  it("moving a marker never changes its player id, team or label", () => {
    const { id, b } = withAssigned();
    const moved = applyOp(b, { type: "move", id, to: { x: 12.345, y: 67.891 } });
    const before = b.objects.find((o) => o.id === id)!;
    const after = moved.objects.find((o) => o.id === id)!;
    expect(after).toEqual({ ...before, x: 12.3, y: 67.9 });
  });

  it("clamps moves and nudges to the pitch", () => {
    const { id, b } = withAssigned();
    const m = applyOp(b, { type: "move", id, to: { x: -20, y: 140 } }).objects.find((o) => o.id === id)!;
    expect(m).toMatchObject({ x: 0, y: 100 });
    const n = applyOp(applyOp(b, { type: "move", id, to: { x: 99.5, y: 0.5 } }), { type: "nudge", id, dx: 5, dy: -5 });
    expect(n.objects.find((o) => o.id === id)).toMatchObject({ x: 100, y: 0 });
  });

  it("does not mutate the input board", () => {
    const { id, b } = withAssigned();
    const snapshot = structuredClone(b);
    applyOp(b, { type: "move", id, to: { x: 1, y: 1 } });
    expect(b).toEqual(snapshot);
  });

  it("caps markers per side at the format and allows one ball", () => {
    const full = boardFromFormation(7, "7-231");
    expect(() => applyOp(full, { type: "add-player", team: "home" })).toThrow(BoardOpError);
    expect(() => applyOp(full, { type: "add-ball" })).toThrow(BoardOpError);
    let b = emptyBoard(5);
    for (let i = 0; i < 5; i++) b = applyOp(b, { type: "add-player", team: "away" });
    expect(countMarkers(b, "away")).toBe(5);
    expect(() => applyOp(b, { type: "add-player", team: "away" })).toThrow(BoardOpError);
  });

  it("won't link one squad player to two markers or to an opponent", () => {
    const { b } = withAssigned();
    expect(() => applyOp(b, { type: "assign", id: b.objects[1].id, playerId: UUID_A, label: "x" })).toThrow(BoardOpError);
    expect(applyOp(b, { type: "assign", id: b.objects[1].id, playerId: UUID_B, label: "2" })).toBeTruthy();
    const withOpp = applyOp(emptyBoard(7), { type: "add-player", team: "away" });
    expect(() => applyOp(withOpp, { type: "assign", id: withOpp.objects[0].id, playerId: UUID_A, label: "1" })).toThrow(BoardOpError);
  });

  it("every op keeps the board schema-valid", () => {
    let b = boardFromFormation(11, "11-433");
    const id = b.objects[3].id;
    b = applyOp(b, { type: "nudge", id, dx: -1, dy: 1 });
    b = applyOp(b, { type: "orientation", orientation: "horizontal" });
    b = applyOp(b, { type: "remove", id });
    b = applyOp(b, { type: "add-player", team: "home" });
    expect(boardSchema.safeParse(b).success).toBe(true);
  });
});
