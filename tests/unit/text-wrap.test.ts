import { describe, expect, it } from "vitest";
import { TEXT_LINE_CHARS, wrapText } from "@/lib/domain/text-wrap";
import { MAX_TEXT } from "@/lib/validation/board";

describe("wrapText", () => {
  it("breaks on word boundaries within the line width", () => {
    expect(wrapText("Keeper starts every build-up")).toEqual(["Keeper starts every", "build-up"]);
  });

  it("hard-breaks words longer than a line and never exceeds the width", () => {
    const lines = wrapText("x".repeat(MAX_TEXT));
    expect(lines.every((l) => l.length <= TEXT_LINE_CHARS)).toBe(true);
    expect(lines.join("")).toBe("x".repeat(MAX_TEXT));
  });

  it("collapses whitespace and handles short text", () => {
    expect(wrapText("  Press   high  ")).toEqual(["Press high"]);
  });
});
