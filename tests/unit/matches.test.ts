import { describe, expect, it } from "vitest";
import { formatKickoff, toZonedParts, zonedTimeToUtc } from "@/lib/domain/time";
import { planReadiness, type ReadinessInput } from "@/lib/domain/plan-readiness";
import { lineupSchema, matchSchema, sectionUpdate } from "@/lib/validation/match";

const P = (n: number) => `6f1e2d3c-4b5a-4987-8a6b-5c4d3e2f1a${String(n).padStart(2, "0")}`;

describe("timezone-aware kickoff (MATCH-01)", () => {
  it.each([
    ["2026-10-25", "14:00", "Europe/London", "2026-10-25T14:00:00.000Z"], // GMT, the day BST ends
    ["2026-10-24", "14:00", "Europe/London", "2026-10-24T13:00:00.000Z"], // BST
    ["2026-07-04", "19:30", "America/New_York", "2026-07-04T23:30:00.000Z"], // EDT
    ["2026-12-01", "09:00", "Asia/Kolkata", "2026-12-01T03:30:00.000Z"], // +05:30
    ["2026-03-29", "01:30", "Europe/London", "2026-03-29T01:30:00.000Z"], // spring gap: moved forward
  ])("%s %s in %s → %s", (d, t, tz, iso) => {
    expect(zonedTimeToUtc(d, t, tz).toISOString()).toBe(iso);
  });

  it("uses the earlier instant in the repeated autumn hour", () => {
    expect(zonedTimeToUtc("2026-10-25", "01:30", "Europe/London").toISOString()).toBe("2026-10-25T00:30:00.000Z");
  });

  it("round-trips for edit forms and formats in the fixture's own zone", () => {
    const iso = zonedTimeToUtc("2026-07-04", "19:30", "America/New_York").toISOString();
    expect(toZonedParts(iso, "America/New_York")).toEqual({ date: "2026-07-04", time: "19:30" });
    expect(formatKickoff(iso, "America/New_York")).toMatch(/Sat.*4 Jul 2026.*19:30/);
    expect(formatKickoff(iso, "Europe/London", { withZone: false })).toMatch(/Sun.*5 Jul 2026.*00:30/);
  });

  it("validates fixture input; venue is optional", () => {
    const ok = matchSchema.parse({ opponentName: " Dynamos ", date: "2026-10-25", time: "14:00", timeZone: "Europe/London", venue: "  " });
    expect(ok).toMatchObject({ opponentName: "Dynamos", venue: null });
    expect(matchSchema.safeParse({ opponentName: "X", date: "2026-10-25", time: "25:00", timeZone: "Europe/London" }).success).toBe(false);
    expect(matchSchema.safeParse({ opponentName: "X", date: "2026-10-25", time: "14:00", timeZone: "Mars/Olympus" }).success).toBe(false);
  });
});

describe("lineup (MATCH-02)", () => {
  it("allows an incomplete draft but not too many starters or duplicates", () => {
    const s = lineupSchema(5);
    expect(s.safeParse([{ playerId: P(1), role: "starter" }]).success).toBe(true);
    expect(s.safeParse(Array.from({ length: 6 }, (_, i) => ({ playerId: P(i), role: "starter" }))).success).toBe(false);
    expect(s.safeParse([{ playerId: P(1), role: "starter" }, { playerId: P(1), role: "bench" }]).success).toBe(false);
    expect(s.safeParse(Array.from({ length: 12 }, (_, i) => ({ playerId: P(i), role: "bench" }))).success).toBe(true);
  });
});

describe("sections (PLAN-01)", () => {
  it("defaults content and caps lengths", () => {
    const r = sectionUpdate.parse({ title: " Shape ", content: {}, includeInBriefing: true });
    expect(r).toEqual({ title: "Shape", content: { phase: "general", notes: "", privateNotes: "" }, includeInBriefing: true });
    expect(sectionUpdate.safeParse({ title: "x", content: { notes: "n".repeat(2001) }, includeInBriefing: true }).success).toBe(false);
  });
});

describe("publish readiness (QA-05)", () => {
  const base = (over: Partial<ReadinessInput> = {}): ReadinessInput => ({
    format: 7,
    starters: Array.from({ length: 7 }, () => ({ archived: false })),
    sections: [{ title: "Shape", type: "board", included: true, hasTactic: true, tacticFormat: 7 }],
    objective: "Win second balls",
    ...over,
  });

  it("is ready with a full lineup and an included section", () => {
    expect(planReadiness(base()).ready).toBe(true);
  });

  it("blocks a 7v7 plan with only 6 starters, using the UX copy", () => {
    const r = planReadiness(base({ starters: Array.from({ length: 6 }, () => ({ archived: false })) }));
    expect(r.ready).toBe(false);
    expect(r.items.find((i) => i.id === "starters")?.message).toBe("Add all 7 starters before publishing this 7v7 match plan.");
  });

  it("blocks when nothing is included or a board has no tactic", () => {
    expect(planReadiness(base({ sections: [] })).ready).toBe(false);
    expect(planReadiness(base({ sections: [{ title: "Shape", type: "board", included: false, hasTactic: true, tacticFormat: 7 }] })).ready).toBe(false);
    expect(planReadiness(base({ sections: [{ title: "Shape", type: "board", included: true, hasTactic: false, tacticFormat: null }] })).ready).toBe(false);
  });

  it("warns, without blocking, on archived starters, mismatched boards and a missing objective", () => {
    const r = planReadiness(
      base({
        starters: [...Array.from({ length: 6 }, () => ({ archived: false })), { archived: true }],
        sections: [{ title: "Old", type: "board", included: true, hasTactic: true, tacticFormat: 11 }],
        objective: "",
      }),
    );
    expect(r.ready).toBe(true);
    expect(r.items.filter((i) => i.level === "warning").map((i) => i.id)).toEqual(["archived", "format:Old", "objective"]);
  });
});
