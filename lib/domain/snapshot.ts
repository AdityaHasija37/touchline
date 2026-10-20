import { z } from "zod";
import { MATCH_FORMATS } from "./format";
import { boardSchema, type Board } from "@/lib/validation/board";
import { PHASE_LABELS, type Phase, type SectionType } from "@/lib/validation/match";

/**
 * Published briefing snapshot v1 (ADR-03, PRES-02). Built by allowlist: only what a player
 * needs, copied at publish time so later edits never change it. Never contains private notes,
 * the squad directory, internal ids or player ids.
 */
export const SNAPSHOT_VERSION = 1;

const person = z.object({ name: z.string().max(60), number: z.number().int().min(0).max(99).nullable() }).strict();

export const snapshotSchema = z
  .object({
    version: z.literal(SNAPSHOT_VERSION),
    publishedAt: z.string(),
    team: z.object({ name: z.string().max(60), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) }).strict(),
    match: z
      .object({
        opponent: z.string().max(60),
        kickoffAt: z.string(),
        kickoffLabel: z.string().max(80),
        venue: z.string().max(120).nullable(),
        format: z.union(MATCH_FORMATS.map((f) => z.literal(f)) as [z.ZodLiteral<5>, z.ZodLiteral<7>, z.ZodLiteral<11>]),
      })
      .strict(),
    objective: z.string().max(280).nullable(),
    lineup: z
      .object({
        starters: z.array(person.extend({ position: z.string().max(12).nullable() }).strict()).max(11),
        bench: z.array(person).max(30),
      })
      .strict(),
    sections: z
      .array(
        z
          .object({
            key: z.string().regex(/^s\d{1,2}$/),
            type: z.enum(["board", "notes", "reminders"]),
            title: z.string().max(80),
            phase: z.string().max(40),
            notes: z.string().max(2000),
            board: boardSchema.nullable(),
          })
          .strict(),
      )
      .max(40),
  })
  .strict();

export type Snapshot = z.infer<typeof snapshotSchema>;

export type SnapshotInput = {
  publishedAt: string;
  team: { name: string; primaryColor: string };
  match: { opponentName: string; kickoffAt: string; kickoffLabel: string; venue: string | null; format: 5 | 7 | 11 };
  objective: string | null;
  lineup: { playerId: string; role: "starter" | "bench"; slot: number | null; position: string | null }[];
  players: { id: string; name: string; shirtNumber: number | null }[];
  sections: {
    type: SectionType;
    title: string;
    includeInBriefing: boolean;
    content: { phase: Phase; notes: string; privateNotes: string };
    tactic: { board: Board | null } | null;
  }[];
};

/** Strip squad-player ids from a board copy; labels on the markers are kept. */
function publicBoard(board: Board): Board {
  return { ...board, objects: board.objects.map((o) => (o.kind === "player" ? { ...o, playerId: null } : o)) };
}

export function buildSnapshot(input: SnapshotInput): Snapshot {
  const byId = new Map(input.players.map((p) => [p.id, p]));
  const resolve = (id: string) => {
    const p = byId.get(id);
    return { name: p?.name ?? "Unknown player", number: p?.shirtNumber ?? null };
  };
  const starters = input.lineup
    .filter((l) => l.role === "starter")
    .sort((a, b) => (a.slot ?? 99) - (b.slot ?? 99))
    .map((l) => ({ ...resolve(l.playerId), position: l.position?.trim() || null }));
  const bench = input.lineup.filter((l) => l.role === "bench").map((l) => resolve(l.playerId));

  const sections = input.sections
    .filter((s) => s.includeInBriefing)
    .map((s, i) => ({
      key: `s${i + 1}`,
      type: s.type,
      title: s.title,
      phase: PHASE_LABELS[s.content.phase],
      notes: s.content.notes.trim(),
      board: s.type === "board" && s.tactic?.board ? publicBoard(s.tactic.board) : null,
    }));

  return snapshotSchema.parse({
    version: SNAPSHOT_VERSION,
    publishedAt: input.publishedAt,
    team: { name: input.team.name, color: input.team.primaryColor },
    match: {
      opponent: input.match.opponentName,
      kickoffAt: input.match.kickoffAt,
      kickoffLabel: input.match.kickoffLabel,
      venue: input.match.venue,
      format: input.match.format,
    },
    objective: input.objective?.trim() || null,
    lineup: { starters, bench },
    sections,
  });
}

/** Content identity, ignoring publish time: used to flag "draft has unpublished changes". */
export function snapshotFingerprint(s: Snapshot): string {
  return JSON.stringify({ ...s, publishedAt: null });
}
