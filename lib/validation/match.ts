import { z } from "zod";
import { isValidTimeZone } from "@/lib/domain/time";
import { DUTIES, ROLE_KEYS } from "@/lib/domain/roles";

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
  // FM-style role + duty + one-line personal instruction (starters only).
  playerRole: z.enum(ROLE_KEYS).optional(),
  duty: z.enum(DUTIES as [string, ...string[]]).optional(),
  instruction: z.string().trim().max(140, "Keep instructions to 140 characters.").optional(),
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

/** Set-piece takers and marking jobs (enhancement 4). Every id must be a starter (checked on save). */
export const SET_PIECE_JOBS = ["captain", "penalties", "freeKicks", "cornersLeft", "cornersRight", "longThrows"] as const;
export type SetPieceJob = (typeof SET_PIECE_JOBS)[number];
export const SET_PIECE_LABELS: Record<SetPieceJob, string> = {
  captain: "Captain",
  penalties: "Penalties",
  freeKicks: "Free kicks",
  cornersLeft: "Corners (left)",
  cornersRight: "Corners (right)",
  longThrows: "Long throws",
};
export const setPiecesSchema = z
  .object({
    captain: z.uuid().optional(),
    penalties: z.uuid().optional(),
    freeKicks: z.uuid().optional(),
    cornersLeft: z.uuid().optional(),
    cornersRight: z.uuid().optional(),
    longThrows: z.uuid().optional(),
    marking: z.array(z.object({ playerId: z.uuid(), target: z.string().trim().min(1, "Say who or where they mark.").max(40) })).max(11).default([]),
  })
  .strict();
export type SetPieces = z.infer<typeof setPiecesSchema>;

/** Substitution plan (enhancement 5). */
export const subPlanSchema = z
  .object({
    matchLength: z.number().int().min(10).max(120),
    subs: z.array(z.object({ minute: z.number().int().min(1).max(119), outId: z.uuid(), inId: z.uuid() })).max(30).default([]),
  })
  .strict();
export type SubPlan = z.infer<typeof subPlanSchema>;

export const objectiveSchema = z.string().trim().max(280, "Keep the objective to 280 characters.");
