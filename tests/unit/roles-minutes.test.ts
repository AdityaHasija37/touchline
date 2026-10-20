import { describe, expect, it } from "vitest";
import { FORMATIONS } from "@/lib/domain/formations";
import { computeMinutes } from "@/lib/domain/minutes";
import { ROLES, defaultRoleFor, positionFit, roleSummary, rolesFor, slotGroup } from "@/lib/domain/roles";
import { lineupSchema, setPiecesSchema, subPlanSchema } from "@/lib/validation/match";

describe("roles and duties (enhancement 1)", () => {
  it("every formation slot maps to a group and a default role that suits it", () => {
    for (const f of FORMATIONS) {
      for (const [label] of f.slots) {
        const g = slotGroup(label);
        expect(g, `${f.id} ${label}`).not.toBeNull();
        const d = defaultRoleFor(label)!;
        const role = ROLES.find((r) => r.key === d.role)!;
        expect(role.groups, `${label} → ${d.role}`).toContain(g);
        expect(role.duties).toContain(d.duty);
      }
    }
  });

  it("filters roles by position group, and every role has at least one duty", () => {
    expect(rolesFor("GK").map((r) => r.key)).toEqual(["goalkeeper", "sweeper_keeper"]);
    expect(rolesFor("FWD").map((r) => r.key)).toContain("poacher");
    expect(rolesFor("FWD").map((r) => r.key)).not.toContain("centre_back");
    expect(ROLES.every((r) => r.duties.length > 0)).toBe(true);
  });

  it("summarises role + duty in FM style", () => {
    expect(roleSummary("inverted_winger", "support")).toBe("Inverted winger (Support)");
    expect(roleSummary("nonsense", "attack")).toBeNull();
  });

  it("accepts roles in a lineup and rejects unknown ones or long instructions", () => {
    const id = "6f1e2d3c-4b5a-4987-8a6b-5c4d3e2f1a01";
    expect(lineupSchema(7).safeParse([{ playerId: id, role: "starter", playerRole: "poacher", duty: "attack", instruction: "Stay on the last man." }]).success).toBe(true);
    expect(lineupSchema(7).safeParse([{ playerId: id, role: "starter", playerRole: "libero" }]).success).toBe(false);
    expect(lineupSchema(7).safeParse([{ playerId: id, role: "starter", instruction: "x".repeat(141) }]).success).toBe(false);
  });
});

describe("position fit (enhancement 2)", () => {
  it.each([
    [["DEF"], "LB", "natural"],
    [["MID"], "LB", "adjacent"],
    [["FWD"], "CB", "out"],
    [["GK"], "ST", "out"],
    [["DEF"], "GK", "out"],
    [["MID", "FWD"], "RW", "natural"],
    [[], "CM", "unknown"],
    [["MID"], "Sweeper", "unknown"],
  ] as const)("%j in %s → %s", (pref, slot, fit) => {
    expect(positionFit([...pref], slot)).toBe(fit);
  });
});

describe("sub plan maths (enhancement 5)", () => {
  const XI = ["a", "b", "c"], BENCH = ["d", "e"];

  it("counts minutes through chained subs", () => {
    const r = computeMinutes(XI, BENCH, [
      { minute: 30, outKey: "a", inKey: "d" },
      { minute: 45, outKey: "d", inKey: "e" },
    ], 60);
    expect(r.minutes).toEqual({ a: 30, b: 60, c: 60, d: 15, e: 15 });
    expect(r.problems).toEqual([null, null]);
    // Fair share of a 60-minute game is 30: a (exactly 30) is fine, d and e (15 each) are short.
    expect(r.short.sort()).toEqual(["d", "e"]);
  });

  it("flags impossible subs without counting them", () => {
    const r = computeMinutes(XI, BENCH, [
      { minute: 20, outKey: "d", inKey: "e" }, // d isn't on
      { minute: 25, outKey: "a", inKey: "b" }, // b already on
      { minute: 70, outKey: "a", inKey: "d" }, // past full time
      { minute: 30, outKey: "a", inKey: "a" },
    ], 60);
    expect(r.problems.every(Boolean)).toBe(true);
    expect(r.minutes.a).toBe(60);
  });

  it("applies subs in time order regardless of input order", () => {
    const r = computeMinutes(XI, BENCH, [
      { minute: 45, outKey: "d", inKey: "e" },
      { minute: 30, outKey: "a", inKey: "d" },
    ], 60);
    expect(r.problems).toEqual([null, null]);
    expect(r.minutes.d).toBe(15);
  });

  it("validates set pieces and sub plans", () => {
    const id = "6f1e2d3c-4b5a-4987-8a6b-5c4d3e2f1a01";
    expect(setPiecesSchema.parse({ captain: id }).marking).toEqual([]);
    expect(setPiecesSchema.safeParse({ captain: "not-a-uuid" }).success).toBe(false);
    expect(setPiecesSchema.safeParse({ tea: id }).success).toBe(false);
    expect(subPlanSchema.safeParse({ matchLength: 5, subs: [] }).success).toBe(false);
    expect(subPlanSchema.parse({ matchLength: 60 }).subs).toEqual([]);
  });
});
