import { z } from "zod";
import { isValidTimeZone } from "@/lib/domain/time";

export const matchSchema = z.object({
  opponentName: z.string().trim().min(1, "Enter the opponent's name.").max(60, "Names can be at most 60 characters."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a kickoff date."),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a kickoff time."),
  timeZone: z.string().refine(isValidTimeZone, "Unknown time zone."),
  venue: z
    .string()
    .trim()
    .max(120, "Venue can be at most 120 characters.")
    .transform((v) => v || null)
    .nullable()
    .default(null),
});

export const lineupEntry = z.object({
  playerId: z.uuid(),
  role: z.enum(["starter", "bench"]),
  slot: z.number().int().min(1).max(11).optional(),
  position: z.string().trim().max(12).optional(),
});
export type LineupEntry = z.infer<typeof lineupEntry>;

/** MATCH-02: unique players, starters ≤ format; drafts may be incomplete. */
export function lineupSchema(format: number) {
  return z
    .array(lineupEntry)
    .max(40)
    .superRefine((list, ctx) => {
      const seen = new Set<string>();
      for (const e of list) {
        if (seen.has(e.playerId)) ctx.addIssue({ code: "custom", message: "A player can only be picked once." });
        seen.add(e.playerId);
      }
      const starters = list.filter((e) => e.role === "starter").length;
      if (starters > format) ctx.addIssue({ code: "custom", message: `A ${format}v${format} lineup can have at most ${format} starters.` });
    });
}

export const PHASES = ["general", "in_possession", "out_of_possession", "transition", "set_pieces"] as const;
export type Phase = (typeof PHASES)[number];
export const PHASE_LABELS: Record<Phase, string> = {
  general: "General",
  in_possession: "In possession",
  out_of_possession: "Out of possession",
  transition: "Transitions",
  set_pieces: "Set pieces",
};

export const SECTION_TYPES = ["board", "notes", "reminders"] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

export const sectionContent = z.object({
  phase: z.enum(PHASES).default("general"),
  notes: z.string().max(2000, "Notes can be at most 2000 characters.").default(""),
  /** Coach-only; never copied into a published briefing (D-05). */
  privateNotes: z.string().max(2000, "Private notes can be at most 2000 characters.").default(""),
});
export type SectionContent = z.infer<typeof sectionContent>;

export const sectionUpdate = z.object({
  title: z.string().trim().min(1, "Give the section a title.").max(80, "Titles can be at most 80 characters."),
  content: sectionContent,
  includeInBriefing: z.boolean(),
});

export const objectiveSchema = z.string().trim().max(280, "Keep the objective to 280 characters.");
