import { z } from "zod";
import { MATCH_FORMATS } from "./format";
import { FORMATIONS } from "./formations";
import { computeMinutes } from "./minutes";
import { roleSummary, type Duty } from "./roles";
import { boardSchema, type Board } from "@/lib/validation/board";
import { PHASE_LABELS, SET_PIECE_JOBS, type Phase, type SectionType, type SetPieces, type SubPlan } from "@/lib/validation/match";

/**
 * Published briefing snapshot v1 (ADR-03, PRES-02). Built by allowlist: only what a player
 * needs, copied at publish time so later edits never change it. Never contains private notes,
 * the squad directory, internal ids or player ids. Players are referenced by per-snapshot keys
 * ("p1", "p2"…) so set pieces, subs and "Find me" can link to them without exposing ids.
 * Fields added for roles/set pieces/subs are optional, so earlier snapshots still parse.
 */
export const SNAPSHOT_VERSION = 1;

const key = z.string().regex(/^p\d{1,2}$/);
const coord = z.number().min(0).max(100);
const person = z.object({ key: key.optional(), name: z.string().max(60), number: z.number().int().min(0).max(99).nullable() }).strict();
const starter = person
  .extend({
    position: z.string().max(12).nullable(),
    role: z.string().max(60).optional(),
    instruction: z.string().max(140).optional(),
    x: coord.optional(),
    y: coord.optional(),
  })
  .strict();

const setPieces = z
  .object({
    captain: key.optional(),
    penalties: key.optional(),
    freeKicks: key.optional(),
    cornersLeft: key.optional(),
    cornersRight: key.optional(),
    longThrows: key.optional(),
    marking: z.array(z.object({ key, target: z.string().max(40) }).strict()).max(11),
  })
  .strict();

const subPlan = z
  .object({
    matchLength: z.number().int().min(10).max(120),
    subs: z.array(z.object({ minute: z.number().int(), outKey: key, inKey: key }).strict()).max(30),
    minutes: z.record(key, z.number().int().min(0).max(120)),
  })
  .strict();

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
        formation: z.string().max(40).optional(),
        starters: z.array(starter).max(11),
        bench: z.array(person).max(30),
      })
      .strict(),
    setPieces: setPieces.optional(),
    subPlan: subPlan.optional(),
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
            /** Board marker id → player key, for "Find me" highlighting. */
            markerRefs: z.record(z.string().max(64), key).optional(),
          })
          .strict(),
      )
      .max(40),
  })
  .strict();

export type Snapshot = z.infer<typeof snapshotSchema>;
export type SnapshotStarter = Snapshot["lineup"]["starters"][number];

export type SnapshotInput = {
  publishedAt: string;
  team: { name: string; primaryColor: string };
  match: { opponentName: string; kickoffAt: string; kickoffLabel: string; venue: string | null; format: 5 | 7 | 11 };
  objective: string | null;
  formationId?: string | null;
  lineup: {
    playerId: string;
    role: "starter" | "bench";
    slot: number | null;
    position: string | null;
    playerRole?: string | null;
    duty?: Duty | null;
    instruction?: string | null;
  }[];
  players: { id: string; name: string; shirtNumber: number | null }[];
  setPieces?: SetPieces | null;
  subPlan?: SubPlan | null;
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
  const formation = input.formationId ? FORMATIONS.find((f) => f.id === input.formationId && f.format === input.match.format) : undefined;

  const startersIn = input.lineup.filter((l) => l.role === "starter").sort((a, b) => (a.slot ?? 99) - (b.slot ?? 99));
  const benchIn = input.lineup.filter((l) => l.role === "bench");
  // Pseudonymous keys: starters in slot order, then the bench.
  const keyOf = new Map<string, string>([...startersIn, ...benchIn].map((l, i) => [l.playerId, `p${i + 1}`]));

  const starters = startersIn.map((l) => {
    const slot = formation && l.slot ? formation.slots[l.slot - 1] : undefined;
    const role = roleSummary(l.playerRole, l.duty ?? null);
    const instruction = l.instruction?.trim();
    return {
      key: keyOf.get(l.playerId)!,
      ...resolve(l.playerId),
      position: l.position?.trim() || slot?.[0] || null,
      ...(role ? { role } : {}),
      ...(instruction ? { instruction } : {}),
      ...(slot ? { x: slot[1], y: slot[2] } : {}),
    };
  });
  const bench = benchIn.map((l) => ({ key: keyOf.get(l.playerId)!, ...resolve(l.playerId) }));

  // Set pieces: only jobs held by starters survive (ids → keys).
  let setPieces: Snapshot["setPieces"];
  if (input.setPieces) {
    const sp = input.setPieces;
    const isStarter = (id?: string) => (id && startersIn.some((s) => s.playerId === id) ? keyOf.get(id) : undefined);
    const jobs = Object.fromEntries(SET_PIECE_JOBS.flatMap((j) => (isStarter(sp[j]) ? [[j, isStarter(sp[j])]] : [])));
    const marking = sp.marking.flatMap((m) => (isStarter(m.playerId) ? [{ key: isStarter(m.playerId)!, target: m.target.trim() }] : []));
    if (Object.keys(jobs).length || marking.length) setPieces = { ...jobs, marking };
  }

  // Sub plan: keep only subs between match-squad players; minutes computed once, here.
  let subPlan: Snapshot["subPlan"];
  if (input.subPlan && input.subPlan.subs.length) {
    const subs = input.subPlan.subs.flatMap((s) =>
      keyOf.has(s.outId) && keyOf.has(s.inId) ? [{ minute: s.minute, outKey: keyOf.get(s.outId)!, inKey: keyOf.get(s.inId)! }] : [],
    );
    const r = computeMinutes(starters.map((s) => s.key), bench.map((b) => b.key), subs, input.subPlan.matchLength);
    const valid = subs.filter((_, i) => !r.problems[i]);
    if (valid.length) subPlan = { matchLength: input.subPlan.matchLength, subs: valid, minutes: r.minutes };
  }

  const sections = input.sections
    .filter((s) => s.includeInBriefing)
    .map((s, i) => {
      const board = s.type === "board" && s.tactic?.board ? s.tactic.board : null;
      const refs = board
        ? Object.fromEntries(board.objects.flatMap((o) => (o.kind === "player" && o.playerId && keyOf.has(o.playerId) ? [[o.id, keyOf.get(o.playerId)!]] : [])))
        : {};
      return {
        key: `s${i + 1}`,
        type: s.type,
        title: s.title,
        phase: PHASE_LABELS[s.content.phase],
        notes: s.content.notes.trim(),
        board: board ? publicBoard(board) : null,
        ...(Object.keys(refs).length ? { markerRefs: refs } : {}),
      };
    });

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
    lineup: { ...(formation ? { formation: formation.name } : {}), starters, bench },
    ...(setPieces ? { setPieces } : {}),
    ...(subPlan ? { subPlan } : {}),
    sections,
  });
}

/**
 * Content identity, ignoring publish time: used to flag "draft has unpublished changes".
 * Keys are sorted because Postgres jsonb reorders object keys, so a stored snapshot and a fresh
 * draft with the same content must still compare equal.
 */
export function snapshotFingerprint(s: Snapshot): string {
  return canonical({ ...s, publishedAt: null });
}

function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v)
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

/** Everything a single player needs for "Find me" (enhancement 3). */
export function playerCard(s: Snapshot, playerKey: string) {
  const starter = s.lineup.starters.find((p) => p.key === playerKey);
  const benchP = s.lineup.bench.find((p) => p.key === playerKey);
  const who = starter ?? benchP;
  if (!who) return null;
  const jobs = SET_PIECE_JOBS.filter((j) => s.setPieces?.[j] === playerKey);
  const marking = s.setPieces?.marking.filter((m) => m.key === playerKey).map((m) => m.target) ?? [];
  const subsIn = s.subPlan?.subs.filter((x) => x.inKey === playerKey).map((x) => x.minute) ?? [];
  const subsOut = s.subPlan?.subs.filter((x) => x.outKey === playerKey).map((x) => x.minute) ?? [];
  const boards = s.sections.filter((sec) => sec.board && Object.values(sec.markerRefs ?? {}).includes(playerKey)).map((sec) => sec.key);
  return {
    key: playerKey,
    name: who.name,
    number: who.number,
    starting: Boolean(starter),
    position: starter?.position ?? null,
    role: starter?.role ?? null,
    instruction: starter?.instruction ?? null,
    jobs,
    marking,
    subsIn,
    subsOut,
    minutes: s.subPlan?.minutes[playerKey] ?? null,
    boards,
  };
}
