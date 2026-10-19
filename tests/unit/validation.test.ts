import { describe, expect, it } from "vitest";
import { teamSchema } from "@/lib/validation/team";
import { playerSchema } from "@/lib/validation/player";
import { newPasswordSchema, safeNext } from "@/lib/validation/auth";

describe("teamSchema (TEAM-01)", () => {
  it("accepts a valid 7v7 team and trims the name", () => {
    const r = teamSchema.parse({ name: "  Sunday Rovers ", matchFormat: "7", primaryColor: "#2f7d4f" });
    expect(r).toEqual({ name: "Sunday Rovers", matchFormat: 7, primaryColor: "#2f7d4f" });
  });

  it.each([
    ["A", "at least 2"],
    ["x".repeat(61), "at most 60"],
  ])("rejects name %j", (name, msg) => {
    const r = teamSchema.safeParse({ name, matchFormat: 7 });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toContain(msg);
  });

  it("rejects formats outside 5/7/11", () => {
    expect(teamSchema.safeParse({ name: "Nines", matchFormat: 9 }).success).toBe(false);
  });

  it("rejects a non-hex colour", () => {
    expect(teamSchema.safeParse({ name: "Rovers", matchFormat: 5, primaryColor: "green" }).success).toBe(false);
  });
});

describe("playerSchema (TEAM-02)", () => {
  it("treats an empty shirt number as none", () => {
    expect(playerSchema.parse({ name: "Sam", shirtNumber: "" }).shirtNumber).toBeNull();
  });

  it("coerces shirt numbers and enforces 0–99", () => {
    expect(playerSchema.parse({ name: "Sam", shirtNumber: "9" }).shirtNumber).toBe(9);
    expect(playerSchema.safeParse({ name: "Sam", shirtNumber: "100" }).success).toBe(false);
    expect(playerSchema.safeParse({ name: "Sam", shirtNumber: "7.5" }).success).toBe(false);
  });

  it("enforces 1–60 character names", () => {
    expect(playerSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(playerSchema.safeParse({ name: "y".repeat(61) }).success).toBe(false);
  });

  it("dedupes positions and rejects unknown ones", () => {
    expect(playerSchema.parse({ name: "Sam", preferredPositions: ["GK", "GK"] }).preferredPositions).toEqual(["GK"]);
    expect(playerSchema.safeParse({ name: "Sam", preferredPositions: ["STRIKER"] }).success).toBe(false);
  });
});

describe("auth helpers (AUTH-01)", () => {
  it("only allows same-site relative redirects", () => {
    expect(safeNext("/app/teams/123")).toBe("/app/teams/123");
    expect(safeNext("https://evil.example")).toBe("/app/teams");
    expect(safeNext("//evil.example")).toBe("/app/teams");
    expect(safeNext("/\\evil.example")).toBe("/app/teams");
    expect(safeNext(undefined)).toBe("/app/teams");
  });

  it("requires matching new passwords of 8+ characters", () => {
    expect(newPasswordSchema.safeParse({ password: "short", confirm: "short" }).success).toBe(false);
    expect(newPasswordSchema.safeParse({ password: "longenough", confirm: "different1" }).success).toBe(false);
    expect(newPasswordSchema.safeParse({ password: "longenough", confirm: "longenough" }).success).toBe(true);
  });
});
