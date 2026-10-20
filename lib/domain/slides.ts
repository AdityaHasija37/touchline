import type { Board } from "@/lib/validation/board";
import { SET_PIECE_JOBS, SET_PIECE_LABELS } from "@/lib/validation/match";
import { FAIR_SHARE } from "./minutes";
import type { Snapshot, SnapshotStarter } from "./snapshot";

/**
 * Canonical slide model (TECH-003 §7). Presenter, public viewer and PDF all render SlideSpec[]
 * built here from a snapshot, never from live plan data, so they can't drift apart.
 */
type Named = { key?: string; name: string; number: number | null };

export type SlideSpec =
  | { id: string; kind: "title"; title: string; subtitle: string; venue: string | null; objective: string | null; teamName: string; format: number }
  | {
      id: string;
      kind: "lineup";
      title: string;
      /** Set when the plan uses a formation: starters then carry x/y and render on a pitch. */
      formation?: string;
      starters: SnapshotStarter[];
      bench: Named[];
    }
  | { id: string; kind: "setpieces"; title: string; jobs: { job: string; label: string; name: string; key: string }[]; marking: { name: string; key: string; target: string }[] }
  | {
      id: string;
      kind: "subs";
      title: string;
      matchLength: number;
      subs: { minute: number; outName: string; inName: string; outKey: string; inKey: string }[];
      minutes: { key: string; name: string; minutes: number; short: boolean }[];
    }
  | { id: string; kind: "board"; title: string; phase: string; notes: string; board: Board | null; markerRefs?: Record<string, string> }
  | { id: string; kind: "notes"; title: string; phase: string; body: string }
  | { id: string; kind: "reminders"; title: string; bullets: string[] };

export function buildSlides(s: Snapshot): SlideSpec[] {
  const people = [...s.lineup.starters, ...s.lineup.bench];
  const nameOf = (key: string) => people.find((p) => p.key === key)?.name ?? "Unknown player";

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
    {
      id: "lineup",
      kind: "lineup",
      title: "Starting lineup",
      ...(s.lineup.formation ? { formation: s.lineup.formation } : {}),
      starters: s.lineup.starters,
      bench: s.lineup.bench,
    },
  ];

  if (s.setPieces) {
    const sp = s.setPieces;
    slides.push({
      id: "setpieces",
      kind: "setpieces",
      title: "Set pieces",
      jobs: SET_PIECE_JOBS.flatMap((j) => (sp[j] ? [{ job: j, label: SET_PIECE_LABELS[j], key: sp[j]!, name: nameOf(sp[j]!) }] : [])),
      marking: sp.marking.map((m) => ({ key: m.key, name: nameOf(m.key), target: m.target })),
    });
  }

  if (s.subPlan) {
    const sub = s.subPlan;
    slides.push({
      id: "subs",
      kind: "subs",
      title: "Sub plan",
      matchLength: sub.matchLength,
      subs: [...sub.subs]
        .sort((a, b) => a.minute - b.minute)
        .map((x) => ({ minute: x.minute, outKey: x.outKey, inKey: x.inKey, outName: nameOf(x.outKey), inName: nameOf(x.inKey) })),
      minutes: people
        .filter((p) => p.key && p.key in sub.minutes)
        .map((p) => ({ key: p.key!, name: p.name, minutes: sub.minutes[p.key!], short: sub.minutes[p.key!] < sub.matchLength * FAIR_SHARE })),
    });
  }

  for (const sec of s.sections) {
    if (sec.type === "board")
      slides.push({
        id: sec.key,
        kind: "board",
        title: sec.title,
        phase: sec.phase,
        notes: sec.notes,
        board: sec.board,
        ...(sec.markerRefs ? { markerRefs: sec.markerRefs } : {}),
      });
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
