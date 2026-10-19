import { describe, expect, it } from "vitest";
import { MATCH_FORMATS, formatLabel, isMatchFormat, startersRequired } from "@/lib/domain/format";

describe("match format", () => {
  it("supports exactly 5v5, 7v7 and 11v11", () => {
    expect(MATCH_FORMATS).toEqual([5, 7, 11]);
  });

  it("rejects formats outside the MVP", () => {
    expect(isMatchFormat(9)).toBe(false);
    expect(isMatchFormat("7")).toBe(false);
    expect(isMatchFormat(7)).toBe(true);
  });

  it("requires a full starting lineup equal to the format", () => {
    expect(startersRequired(7)).toBe(7);
    expect(formatLabel(11)).toBe("11v11");
  });
});
