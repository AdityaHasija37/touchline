// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { applyOp } from "@/lib/domain/board-ops";
import { boardFromFormation } from "@/lib/domain/formations";
import { buildSlides } from "@/lib/domain/slides";
import { buildSnapshot, type Snapshot } from "@/lib/domain/snapshot";
import { pdfFilename, renderBriefingPdf } from "@/lib/pdf/briefing-pdf";

const PID = (n: number) => `6f1e2d3c-4b5a-4987-8a6b-5c4d3e2f1a${String(n).padStart(2, "0")}`;

function snapshot(format: 5 | 7 | 11, formation: string, orientation: "vertical" | "horizontal" = "vertical"): Snapshot {
  let board = { ...boardFromFormation(format, formation), orientation };
  board = applyOp(board, { type: "add-arrow", from: { x: 50, y: 60 }, to: { x: 50, y: 30 }, style: "run" });
  const names = ["Łukasz Żółć", "Siobhán Ó Briain", "Дмитрий Иванов", "Νίκος Παπαδόπουλος", "Sam Okafor", "Kai Brennan", "Lee Novak", "Max Adeyemi", "Jo Lindqvist", "Alex Moreno", "Riley Chen"];
  return buildSnapshot({
    publishedAt: "2026-10-20T10:00:00.000Z",
    team: { name: "Rovers Ünited", primaryColor: "#1d4ed8" },
    match: { opponentName: "Dynamos", kickoffAt: "2026-10-24T13:00:00.000Z", kickoffLabel: "Sat, 24 Oct 2026, 14:00 BST", venue: "Riverside Park", format },
    objective: "Win the second balls",
    lineup: names.slice(0, format).map((_, i) => ({ playerId: PID(i), role: "starter" as const, slot: i + 1, position: i === 0 ? "GK" : null })),
    players: names.map((name, i) => ({ id: PID(i), name, shirtNumber: i + 1 })),
    sections: [
      { type: "board", title: "Our shape", includeInBriefing: true, content: { phase: "out_of_possession", notes: "Stay compact.", privateNotes: "PRIVATE" }, tactic: { board } },
      { type: "notes", title: "Set pieces", includeInBriefing: true, content: { phase: "set_pieces", notes: "Near post on every corner.", privateNotes: "" }, tactic: null },
      { type: "reminders", title: "Final reminders", includeInBriefing: true, content: { phase: "general", notes: "Talk early\nWin the first header", privateNotes: "" }, tactic: null },
    ],
  });
}

async function pagesText(pdf: Buffer): Promise<string[]> {
  const doc = await getDocument({ data: new Uint8Array(pdf), useSystemFonts: false }).promise;
  const out: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    out.push(content.items.map((it) => ("str" in it ? it.str : "")).join(" ").replace(/\s+/g, " "));
  }
  return out;
}

describe("PDF export (EXP-01 / QA-08)", () => {
  it.each([
    [5, "5-22", "vertical"],
    [7, "7-231", "vertical"],
    [11, "11-433", "horizontal"],
  ] as const)("%iv%i: one page per slide, same order and content as the presenter", async (format, formation, orientation) => {
    const snap = snapshot(format, formation, orientation);
    const slides = buildSlides(snap);
    const pages = await pagesText(await renderBriefingPdf(snap));
    expect(pages).toHaveLength(slides.length);
    slides.forEach((slide, i) => {
      const title = slide.kind === "title" ? "Dynamos" : slide.title;
      expect(pages[i], `page ${i + 1}`).toContain(title);
      expect(pages[i]).toContain(`${i + 1} / ${slides.length}`);
    });
    // The lineup page lists the starters: the first pick and a later one are both there.
    expect(pages[1]).toContain("Łukasz Żółć");
    expect(pages[1]).toContain(["Sam Okafor", "Kai Brennan", "Riley Chen"][[5, 7, 11].indexOf(format)]);
    expect(pages.join(" ")).not.toContain("PRIVATE");
  }, 30_000);

  it("keeps non-English names intact (embedded Unicode font)", async () => {
    const pages = await pagesText(await renderBriefingPdf(snapshot(5, "5-22")));
    for (const name of ["Łukasz Żółć", "Siobhán Ó Briain", "Дмитрий Иванов", "Νίκος Παπαδόπουλος", "Rovers Ünited"]) {
      expect(pages.join(" ")).toContain(name);
    }
  }, 30_000);

  it("names the file after the team, opponent and date", () => {
    expect(pdfFilename(snapshot(7, "7-231"))).toBe("touchline-rovers-united-vs-dynamos-2026-10-24.pdf");
  });
});
