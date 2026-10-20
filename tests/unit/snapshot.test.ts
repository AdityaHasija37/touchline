import { describe, expect, it } from "vitest";
import { boardFromFormation } from "@/lib/domain/formations";
import { applyOp } from "@/lib/domain/board-ops";
import { buildSlides } from "@/lib/domain/slides";
import { buildSnapshot, playerCard, snapshotFingerprint, snapshotSchema, type SnapshotInput } from "@/lib/domain/snapshot";

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
      { key: "p1", name: "Sam Okafor", number: 1, position: "GK" },
      { key: "p2", name: "Alex Moreno", number: null, position: "DF" },
    ]);
    expect(snap.lineup.bench).toEqual([{ key: "p3", name: "Dani Ruiz", number: 14 }]);
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

describe("roles, set pieces, sub plan and Find me (enhancements 1–5)", () => {
  const rich = () =>
    input({
      formationId: "5-22",
      lineup: [
        { playerId: PID(1), role: "starter", slot: 1, position: null, playerRole: "sweeper_keeper", duty: "support", instruction: "  Play short to the full-backs " },
        { playerId: PID(2), role: "starter", slot: 2, position: null, playerRole: "full_back", duty: "attack", instruction: null },
        { playerId: PID(3), role: "bench", slot: null, position: null },
      ],
      setPieces: { captain: PID(2), penalties: PID(3), freeKicks: PID(4), marking: [{ playerId: PID(1), target: "Their #9" }] },
      subPlan: {
        matchLength: 40,
        subs: [
          { minute: 20, outId: PID(2), inId: PID(3) },
          { minute: 30, outId: PID(4), inId: PID(1) },
        ],
      },
    });

  it("adds roles, instruction and formation coordinates to starters", () => {
    const snap = buildSnapshot(rich());
    expect(snap.lineup.formation).toBe("2-2 box");
    expect(snap.lineup.starters[0]).toEqual({ key: "p1", name: "Sam Okafor", number: 1, position: "GK", role: "Sweeper keeper (Support)", instruction: "Play short to the full-backs", x: 50, y: 92 });
    expect(snap.lineup.starters[1]).toMatchObject({ position: "LB", role: "Full-back (Attack)", x: 30, y: 70 });
  });

  it("keeps set-piece jobs only for starters and maps ids to keys", () => {
    const sp = buildSnapshot(rich()).setPieces!;
    expect(sp).toEqual({ captain: "p2", marking: [{ key: "p1", target: "Their #9" }] });
  });

  it("drops subs involving players outside the squad and computes minutes", () => {
    const sub = buildSnapshot(rich()).subPlan!;
    expect(sub.subs).toEqual([{ minute: 20, outKey: "p2", inKey: "p3" }]);
    expect(sub.minutes).toEqual({ p1: 40, p2: 20, p3: 20 });
  });

  it("never contains player ids anywhere, including new fields", () => {
    const json = JSON.stringify(buildSnapshot(rich()));
    for (let n = 1; n <= 4; n++) expect(json).not.toContain(PID(n));
  });

  it("links board markers to player keys for highlighting", () => {
    const snap = buildSnapshot(rich());
    const marker = BASE_BOARD.objects[0].id;
    expect(snap.sections[0].markerRefs).toEqual({ [marker]: "p1" });
  });

  it("parses snapshots published before these fields existed", () => {
    const old = {
      version: 1, publishedAt: "x", team: { name: "T", color: "#000000" },
      match: { opponent: "O", kickoffAt: "k", kickoffLabel: "l", venue: null, format: 5 }, objective: null,
      lineup: { starters: [{ name: "A", number: 1, position: "GK" }], bench: [{ name: "B", number: null }] },
      sections: [],
    };
    const parsed = snapshotSchema.parse(old);
    expect(buildSlides(parsed).map((s) => s.kind)).toEqual(["title", "lineup"]);
  });

  it("orders slides: title, lineup, set pieces, sub plan, sections", () => {
    const slides = buildSlides(buildSnapshot(rich()));
    expect(slides.map((s) => s.id)).toEqual(["title", "lineup", "setpieces", "subs", "s1", "s2"]);
    const subs = slides[3];
    if (subs.kind !== "subs") throw new Error("expected subs slide");
    expect(subs.subs[0]).toMatchObject({ minute: 20, outName: "Alex Moreno", inName: "Dani Ruiz" });
    expect(subs.minutes.find((m) => m.key === "p2")).toMatchObject({ minutes: 20, short: false });
  });

  it("fingerprint ignores key order, as after a jsonb round trip", () => {
    const snap = buildSnapshot(rich());
    const reverse = (v: unknown): unknown =>
      Array.isArray(v) ? v.map(reverse) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, reverse(x)])) : v;
    const shuffled = reverse(snap) as typeof snap;
    expect(JSON.stringify(shuffled)).not.toBe(JSON.stringify(snap));
    expect(snapshotFingerprint(shuffled)).toBe(snapshotFingerprint(snap));
  });

  it("builds a personal card for Find me", () => {
    const snap = buildSnapshot(rich());
    expect(playerCard(snap, "p2")).toMatchObject({ name: "Alex Moreno", starting: true, position: "LB", jobs: ["captain"], subsOut: [20], minutes: 20 });
    expect(playerCard(snap, "p1")).toMatchObject({ marking: ["Their #9"], boards: ["s1"], instruction: "Play short to the full-backs" });
    expect(playerCard(snap, "p3")).toMatchObject({ starting: false, subsIn: [20] });
    expect(playerCard(snap, "p9")).toBeNull();
  });
});
