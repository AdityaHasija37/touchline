import { describe, expect, it } from "vitest";
import { boardFromFormation } from "@/lib/domain/formations";
import { applyOp } from "@/lib/domain/board-ops";
import { buildSlides } from "@/lib/domain/slides";
import { buildSnapshot, snapshotFingerprint, snapshotSchema, type SnapshotInput } from "@/lib/domain/snapshot";

const PID = (n: number) => `6f1e2d3c-4b5a-4987-8a6b-5c4d3e2f1a${String(n).padStart(2, "0")}`;

// One board with stable object ids, as it would come from the database.
const BASE_BOARD = (() => {
  const b = boardFromFormation(5, "5-22");
  return applyOp(b, { type: "assign", id: b.objects[0].id, playerId: PID(1), label: "1" });
})();

function input(over: Partial<SnapshotInput> = {}): SnapshotInput {
  const board = structuredClone(BASE_BOARD);
  return {
    publishedAt: "2026-10-19T12:00:00.000Z",
    team: { name: "Rovers Five", primaryColor: "#1d4ed8" },
    match: { opponentName: "Dynamos", kickoffAt: "2026-10-25T14:00:00.000Z", kickoffLabel: "Sun 25 Oct 2026, 14:00 GMT", venue: null, format: 5 },
    objective: "  Win second balls ",
    lineup: [
      { playerId: PID(2), role: "starter", slot: 2, position: "DF" },
      { playerId: PID(1), role: "starter", slot: 1, position: "GK" },
      { playerId: PID(3), role: "bench", slot: null, position: null },
    ],
    players: [
      { id: PID(1), name: "Sam Okafor", shirtNumber: 1 },
      { id: PID(2), name: "Alex Moreno", shirtNumber: null },
      { id: PID(3), name: "Dani Ruiz", shirtNumber: 14 },
      { id: PID(4), name: "Not Picked", shirtNumber: 9 },
    ],
    sections: [
      { type: "board", title: "Shape", includeInBriefing: true, content: { phase: "out_of_possession", notes: "Compact", privateNotes: "SECRET-A" }, tactic: { board } },
      { type: "notes", title: "Hidden", includeInBriefing: false, content: { phase: "general", notes: "draft idea", privateNotes: "" }, tactic: null },
      { type: "reminders", title: "Final reminders", includeInBriefing: true, content: { phase: "general", notes: "- Talk early\n\n• Win the first header\nShake hands", privateNotes: "SECRET-B" }, tactic: null },
    ],
    ...over,
  };
}

describe("published snapshot (PRES-02 allowlist)", () => {
  it("contains no private notes, excluded sections, unpicked players or ids", () => {
    const snap = buildSnapshot(input());
    const json = JSON.stringify(snap);
    for (const secret of ["SECRET-A", "SECRET-B", "draft idea", "Hidden", "Not Picked", PID(1), PID(2), PID(4), "privateNotes", "playerId\":\"6f"]) {
      expect(json, secret).not.toContain(secret);
    }
    expect(snapshotSchema.safeParse(snap).success).toBe(true);
  });

  it("resolves names and numbers, keeps starter order and section order", () => {
    const snap = buildSnapshot(input());
    expect(snap.lineup.starters).toEqual([
      { name: "Sam Okafor", number: 1, position: "GK" },
      { name: "Alex Moreno", number: null, position: "DF" },
    ]);
    expect(snap.lineup.bench).toEqual([{ name: "Dani Ruiz", number: 14 }]);
    expect(snap.sections.map((s) => [s.key, s.title])).toEqual([
      ["s1", "Shape"],
      ["s2", "Final reminders"],
    ]);
    expect(snap.objective).toBe("Win second balls");
    expect(snap.sections[0].phase).toBe("Out of possession");
  });

  it("copies the board so later edits to the source can't change it (QA-06)", () => {
    const src = input();
    const snap = buildSnapshot(src);
    const before = JSON.stringify(snap.sections[0].board);
    src.sections[0].tactic!.board!.objects[1] = { ...src.sections[0].tactic!.board!.objects[1], x: 1 } as never;
    expect(JSON.stringify(snap.sections[0].board)).toBe(before);
  });

  it("strict schema rejects unexpected fields", () => {
    const snap = buildSnapshot(input()) as Record<string, unknown>;
    expect(snapshotSchema.safeParse({ ...snap, squad: [] }).success).toBe(false);
  });

  it("fingerprint ignores publish time but sees content changes", () => {
    const a = buildSnapshot(input());
    const b = buildSnapshot(input({ publishedAt: "2030-01-01T00:00:00.000Z" }));
    const c = buildSnapshot(input({ objective: "Something else" }));
    expect(snapshotFingerprint(a)).toBe(snapshotFingerprint(b));
    expect(snapshotFingerprint(a)).not.toBe(snapshotFingerprint(c));
  });
});

describe("SlideSpec (PRES-01)", () => {
  it("title, lineup, then included sections in stored order", () => {
    const slides = buildSlides(buildSnapshot(input()));
    expect(slides.map((s) => s.kind)).toEqual(["title", "lineup", "board", "reminders"]);
    expect(slides[0]).toMatchObject({ title: "vs Dynamos", subtitle: "Sun 25 Oct 2026, 14:00 GMT", objective: "Win second balls" });
  });

  it("turns reminder lines into bullets, stripping list markers and blanks", () => {
    const r = buildSlides(buildSnapshot(input())).at(-1)!;
    expect(r).toMatchObject({ kind: "reminders", bullets: ["Talk early", "Win the first header", "Shake hands"] });
  });
});
