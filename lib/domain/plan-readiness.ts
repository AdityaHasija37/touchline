import type { MatchFormat } from "./format";

/**
 * Whether a match plan can be published (PRD §6, UX-002 S07 validation checklist).
 * Blocking items stop publication; warnings are shown but don't block. Drafts can always be saved.
 */
export type ReadinessItem = { id: string; level: "blocking" | "warning" | "ok"; message: string };

export type ReadinessInput = {
  format: MatchFormat;
  starters: { archived: boolean }[];
  sections: { title: string; type: "board" | "notes" | "reminders"; included: boolean; hasTactic: boolean; tacticFormat: number | null }[];
  objective: string | null;
};

export function planReadiness(input: ReadinessInput): { ready: boolean; items: ReadinessItem[] } {
  const items: ReadinessItem[] = [];
  const n = input.starters.length;
  const f = input.format;

  items.push(
    n === f
      ? { id: "starters", level: "ok", message: `All ${f} starters picked.` }
      : { id: "starters", level: "blocking", message: `Add all ${f} starters before publishing this ${f}v${f} match plan.` },
  );

  const archived = input.starters.filter((s) => s.archived).length;
  if (archived) items.push({ id: "archived", level: "warning", message: `${archived} starter${archived === 1 ? " is" : "s are"} archived from the squad.` });

  const included = input.sections.filter((s) => s.included);
  items.push(
    included.length
      ? { id: "sections", level: "ok", message: `${included.length} section${included.length === 1 ? "" : "s"} in the briefing.` }
      : { id: "sections", level: "blocking", message: "Add at least one section to the briefing." },
  );

  for (const s of included) {
    if (s.type === "board" && !s.hasTactic) items.push({ id: `tactic:${s.title}`, level: "blocking", message: `“${s.title}” has no tactic attached.` });
    else if (s.type === "board" && s.tacticFormat !== null && s.tacticFormat !== f) {
      items.push({ id: `format:${s.title}`, level: "warning", message: `“${s.title}” uses a ${s.tacticFormat}v${s.tacticFormat} board in a ${f}v${f} match.` });
    }
  }

  if (!input.objective?.trim()) items.push({ id: "objective", level: "warning", message: "No match objective yet. Players like to know the one big idea." });

  return { ready: items.every((i) => i.level !== "blocking"), items };
}
