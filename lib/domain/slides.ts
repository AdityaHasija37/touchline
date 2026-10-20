import type { Board } from "@/lib/validation/board";
import type { Snapshot } from "./snapshot";

/**
 * Canonical slide model (TECH-003 §7). Presenter, public viewer and PDF all render SlideSpec[]
 * built here from a snapshot, never from live plan data, so they can't drift apart.
 */
export type SlideSpec =
  | { id: string; kind: "title"; title: string; subtitle: string; venue: string | null; objective: string | null; teamName: string; format: number }
  | {
      id: string;
      kind: "lineup";
      title: string;
      starters: { name: string; number: number | null; position: string | null }[];
      bench: { name: string; number: number | null }[];
    }
  | { id: string; kind: "board"; title: string; phase: string; notes: string; board: Board | null }
  | { id: string; kind: "notes"; title: string; phase: string; body: string }
  | { id: string; kind: "reminders"; title: string; bullets: string[] };

export function buildSlides(s: Snapshot): SlideSpec[] {
  const slides: SlideSpec[] = [
    {
      id: "title",
      kind: "title",
      title: `vs ${s.match.opponent}`,
      subtitle: s.match.kickoffLabel,
      venue: s.match.venue,
      objective: s.objective,
      teamName: s.team.name,
      format: s.match.format,
    },
    { id: "lineup", kind: "lineup", title: "Starting lineup", starters: s.lineup.starters, bench: s.lineup.bench },
  ];
  for (const sec of s.sections) {
    if (sec.type === "board") slides.push({ id: sec.key, kind: "board", title: sec.title, phase: sec.phase, notes: sec.notes, board: sec.board });
    else if (sec.type === "notes") slides.push({ id: sec.key, kind: "notes", title: sec.title, phase: sec.phase, body: sec.notes });
    else
      slides.push({
        id: sec.key,
        kind: "reminders",
        title: sec.title,
        bullets: sec.notes
          .split("\n")
          .map((l) => l.replace(/^[-•*]\s*/, "").trim())
          .filter(Boolean),
      });
  }
  return slides;
}
