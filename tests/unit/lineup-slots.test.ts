import { describe, expect, it } from "vitest";
import { FORMATIONS } from "@/lib/domain/formations";
import { assignSlot, withFormation } from "@/lib/domain/lineup-slots";
import { planReadiness } from "@/lib/domain/plan-readiness";
import type { LineupEntry } from "@/lib/validation/match";
import type { Position } from "@/lib/validation/player";

const box = FORMATIONS.find((f) => f.id === "5-22")!; // GK, LB, RB, LF, RF
const prefs: Record<string, Position[]> = { gk: ["GK"], d1: ["DEF"], d2: ["DEF"], f1: ["FWD"], f2: ["FWD"], m1: ["MID"] };
const preferred = (id: string) => prefs[id] ?? [];
const start = (...ids: string[]): LineupEntry[] => ids.map((playerId) => ({ playerId, role: "starter" }));

describe("squad on the pitch (LINE-02)", () => {
  it("places each starter in the free slot that suits them best", () => {
    const out = withFormation(start("f1", "gk", "d1", "f2", "d2"), box, preferred);
    expect(Object.fromEntries(out.map((e) => [e.playerId, e.position]))).toEqual({ f1: "LF", gk: "GK", d1: "LB", f2: "RF", d2: "RB" });
    expect(new Set(out.map((e) => e.slot)).size).toBe(5);
  });

  it("keeps existing valid slots and gives slot-appropriate default roles", () => {
    const out = withFormation([{ playerId: "m1", role: "starter", slot: 4 }, ...start("gk")], box, preferred);
    expect(out[0]).toMatchObject({ slot: 4, position: "LF", playerRole: "inside_forward", duty: "support" });
    expect(out[1]).toMatchObject({ slot: 1, position: "GK", playerRole: "goalkeeper", duty: "defend" });
  });

  it("swaps two starters, or benches the occupant for an incoming player", () => {
    const placed = withFormation(start("gk", "d1", "d2", "f1", "f2"), box, preferred);
    const swapped = assignSlot(placed, box, 2, "f1"); // f1 to LB, d1 to f1's old LF
    expect(swapped.find((e) => e.playerId === "f1")).toMatchObject({ slot: 2, position: "LB" });
    expect(swapped.find((e) => e.playerId === "d1")).toMatchObject({ slot: 4, position: "LF" });
    const subbed = assignSlot(placed, box, 5, "m1");
    expect(subbed.find((e) => e.playerId === "m1")).toMatchObject({ role: "starter", slot: 5 });
    expect(subbed.find((e) => e.playerId === "f2")).toEqual({ playerId: "f2", role: "bench" });
  });

  it("removing the formation drops slots but keeps positions and roles", () => {
    const placed = withFormation(start("gk"), box, preferred);
    expect(withFormation(placed, null, preferred)[0]).toMatchObject({ slot: undefined, position: "GK", playerRole: "goalkeeper" });
  });
});

describe("readiness warnings for 1.1 never block publishing (D-08)", () => {
  it("adds warnings only", () => {
    const r = planReadiness({
      format: 5,
      starters: Array.from({ length: 5 }, () => ({ archived: false })),
      sections: [{ title: "R", type: "reminders", included: true, hasTactic: false, tacticFormat: null }],
      objective: "x",
      outOfPosition: 2,
      subProblems: 1,
      shortMinutes: 3,
    });
    expect(r.ready).toBe(true);
    expect(r.items.filter((i) => i.level === "warning").map((i) => i.message)).toEqual([
      "2 starters are out of position.",
      "1 sub doesn't work and will be left out of the briefing.",
      "3 players get under half the match.",
    ]);
  });
});
