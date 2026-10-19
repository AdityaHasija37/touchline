import { describe, expect, it } from "vitest";
import { GRASS, contrastRatio, markerFill } from "@/lib/domain/colors";
import { TEAM_COLORS } from "@/lib/validation/team";

describe("marker colours", () => {
  it.each(TEAM_COLORS)("%s markers reach 3:1 against the grass", (c) => {
    expect(contrastRatio(markerFill(c), GRASS)).toBeGreaterThanOrEqual(3);
  });

  it("leaves already-contrasting colours alone", () => {
    expect(markerFill("#111827")).toBe("#111827");
  });
});
