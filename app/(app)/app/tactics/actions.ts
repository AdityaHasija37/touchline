"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { boardFromFormation, formationsFor } from "@/lib/domain/formations";
import type { MatchFormat } from "@/lib/domain/format";
import { fieldErrorsOf, type ActionState } from "@/lib/validation/form";
import { TACTIC_CATEGORIES, boardSchema, tacticNameSchema } from "@/lib/validation/board";
import { track } from "@/lib/analytics/track";

const uuid = z.uuid();
const NOT_FOUND: ActionState = { status: "error", message: "That tactic no longer exists or you don't have access." };

const createSchema = z.object({
  name: tacticNameSchema,
  category: z.enum(TACTIC_CATEGORIES).default("shape"),
  start: z.string().min(1, "Choose a formation or a blank pitch."),
});

// --- Create / rename / duplicate / delete (TAC-01, TAC-03) -------------------

export async function createTactic(teamId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  if (!uuid.safeParse(teamId).success) return NOT_FOUND;
  const raw = { name: fd.get("name"), category: fd.get("category") ?? undefined, start: fd.get("start") };
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsOf(parsed.error), values: raw };

  const supabase = await createClient();
  const { data: team } = await supabase.from("teams").select("match_format").eq("id", teamId).maybeSingle();
  if (!team) return NOT_FOUND;
  const format = team.match_format as MatchFormat;
  const formationId = parsed.data.start === "blank" ? null : parsed.data.start;
  if (formationId && !formationsFor(format).some((f) => f.id === formationId)) {
    return { status: "error", fieldErrors: { start: ["That formation doesn't match this team's format."] }, values: raw };
  }

  const board = boardFromFormation(format, formationId);
  const { data, error } = await supabase
    .from("tactics")
    .insert({ team_id: teamId, name: parsed.data.name, category: parsed.data.category, format, board_json: board })
    .select("id")
    .single();
  if (error) return { status: "error", message: "Couldn't create the tactic. Try again.", values: raw };

  revalidatePath(`/app/teams/${teamId}/tactics`);
  redirect(`/app/tactics/${data.id}`);
}

export type RenameResult = { status: "saved"; name: string } | { status: "error"; message: string };

export async function renameTactic(tacticId: string, name: string, category: string): Promise<RenameResult> {
  await requireUser();
  const n = tacticNameSchema.safeParse(name);
  if (!n.success) return { status: "error", message: n.error.issues[0].message };
  const c = z.enum(TACTIC_CATEGORIES).safeParse(category);
  if (!uuid.safeParse(tacticId).success || !c.success) return { status: "error", message: "Invalid request." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tactics")
    .update({ name: n.data, category: c.data })
    .eq("id", tacticId)
    .select("team_id");
  if (error) return { status: "error", message: "Couldn't rename. Try again." };
  if (!data.length) return { status: "error", message: "That tactic no longer exists." };
  revalidatePath(`/app/teams/${data[0].team_id}/tactics`);
  return { status: "saved", name: n.data };
}

export async function duplicateTactic(tacticId: string): Promise<ActionState & { id?: string }> {
  await requireUser();
  if (!uuid.safeParse(tacticId).success) return NOT_FOUND;
  const supabase = await createClient();
  const { data: src } = await supabase
    .from("tactics")
    .select("team_id, name, category, format, board_json")
    .eq("id", tacticId)
    .maybeSingle();
  if (!src) return NOT_FOUND;
  const name = `Copy of ${src.name}`.slice(0, 60);
  const { data, error } = await supabase
    .from("tactics")
    .insert({ team_id: src.team_id, name, category: src.category, format: src.format, board_json: src.board_json })
    .select("id")
    .single();
  if (error) return { status: "error", message: "Couldn't duplicate the tactic. Try again." };
  revalidatePath(`/app/teams/${src.team_id}/tactics`);
  return { status: "success", message: `Created “${name}”.`, id: data.id };
}

export async function deleteTactic(tacticId: string): Promise<ActionState> {
  await requireUser();
  if (!uuid.safeParse(tacticId).success) return NOT_FOUND;
  const supabase = await createClient();
  const { data, error } = await supabase.from("tactics").delete().eq("id", tacticId).select("team_id, name");
  if (error) return { status: "error", message: "Couldn't delete the tactic. Try again." };
  if (!data.length) return NOT_FOUND;
  revalidatePath(`/app/teams/${data[0].team_id}/tactics`);
  return { status: "success", message: `Deleted “${data[0].name}”.` };
}

// --- Save board with optimistic concurrency (TAC-03, QA-04) --------------------

export type SaveResult =
  | { status: "saved"; version: number; savedAt: string }
  | { status: "conflict"; serverVersion: number }
  | { status: "invalid"; message: string }
  | { status: "not_found" }
  | { status: "error"; message: string };

export async function saveTacticBoard(tacticId: string, board: unknown, expectedVersion: number): Promise<SaveResult> {
  await requireUser();
  if (!uuid.safeParse(tacticId).success || !Number.isInteger(expectedVersion)) return { status: "not_found" };
  const parsed = boardSchema.safeParse(board);
  if (!parsed.success) return { status: "invalid", message: parsed.error.issues[0]?.message ?? "Board data is invalid." };

  const supabase = await createClient();
  const { data: current } = await supabase.from("tactics").select("team_id, format, version").eq("id", tacticId).maybeSingle();
  if (!current) return { status: "not_found" };
  if (current.format !== parsed.data.format) return { status: "invalid", message: "Board format doesn't match this tactic." };

  // Linked squad players must belong to this team, so a crafted board can't reference anyone else's roster.
  const linked = parsed.data.objects.flatMap((o) => (o.kind === "player" && o.playerId ? [o.playerId] : []));
  if (linked.length) {
    const { data: own } = await supabase.from("players").select("id").eq("team_id", current.team_id).in("id", linked);
    if ((own?.length ?? 0) !== linked.length) return { status: "invalid", message: "A linked player isn't in this squad." };
  }

  if (current.version !== expectedVersion) return { status: "conflict", serverVersion: current.version };

  // Conditional on version, so a concurrent save between the read above and this write still conflicts.
  const { data, error } = await supabase
    .from("tactics")
    .update({ board_json: parsed.data })
    .eq("id", tacticId)
    .eq("version", expectedVersion)
    .select("version, updated_at");
  if (error) return { status: "error", message: "The server couldn't save the board." };
  if (!data.length) {
    const { data: again } = await supabase.from("tactics").select("version").eq("id", tacticId).maybeSingle();
    return again ? { status: "conflict", serverVersion: again.version } : { status: "not_found" };
  }
  await track("tactic_saved", current.team_id, { format: parsed.data.format, object_count: parsed.data.objects.length });
  revalidatePath(`/app/teams/${current.team_id}/tactics`);
  return { status: "saved", version: data[0].version, savedAt: data[0].updated_at };
}

/** Conflict recovery: keep the local board as a new tactic instead of overwriting (UX-002 §7). */
export async function saveBoardAsCopy(tacticId: string, board: unknown): Promise<{ status: "created"; id: string } | { status: "error"; message: string }> {
  await requireUser();
  if (!uuid.safeParse(tacticId).success) return { status: "error", message: "Invalid request." };
  const parsed = boardSchema.safeParse(board);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Board data is invalid." };
  const supabase = await createClient();
  const { data: src } = await supabase.from("tactics").select("team_id, name, category, format").eq("id", tacticId).maybeSingle();
  if (!src) return { status: "error", message: "The original tactic no longer exists." };
  if (src.format !== parsed.data.format) return { status: "error", message: "Board format doesn't match." };
  const linked = parsed.data.objects.flatMap((o) => (o.kind === "player" && o.playerId ? [o.playerId] : []));
  if (linked.length) {
    const { data: own } = await supabase.from("players").select("id").eq("team_id", src.team_id).in("id", linked);
    if ((own?.length ?? 0) !== linked.length) return { status: "error", message: "A linked player isn't in this squad." };
  }
  const { data, error } = await supabase
    .from("tactics")
    .insert({ team_id: src.team_id, name: `${src.name} (my copy)`.slice(0, 60), category: src.category, format: src.format, board_json: parsed.data })
    .select("id")
    .single();
  if (error) return { status: "error", message: "Couldn't save a copy. Try again." };
  revalidatePath(`/app/teams/${src.team_id}/tactics`);
  return { status: "created", id: data.id };
}
