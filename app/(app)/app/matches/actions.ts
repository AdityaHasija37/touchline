"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { zonedTimeToUtc } from "@/lib/domain/time";
import { fieldErrorsOf, type ActionState } from "@/lib/validation/form";
import {
  lineupSchema,
  matchSchema,
  objectiveSchema,
  sectionUpdate,
  setPiecesSchema,
  subPlanSchema,
  SET_PIECE_JOBS,
  SECTION_TYPES,
  type LineupEntry,
  type SectionType,
} from "@/lib/validation/match";
import { track } from "@/lib/analytics/track";
import { FORMATIONS } from "@/lib/domain/formations";
import { roleByKey, type Duty } from "@/lib/domain/roles";

const uuid = z.uuid();
const NOT_FOUND: ActionState = { status: "error", message: "That fixture no longer exists or you don't have access." };
type Result = { status: "saved" } | { status: "error"; message: string };

function matchValues(fd: FormData) {
  return {
    opponentName: fd.get("opponentName"),
    date: fd.get("date"),
    time: fd.get("time"),
    timeZone: fd.get("timeZone"),
    venue: fd.get("venue") ?? "",
  };
}

async function planContext(planId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("match_plans").select("id, match_id, matches(team_id, match_format)").eq("id", planId).maybeSingle();
  if (!data) return null;
  const m = data.matches as unknown as { team_id: string; match_format: number };
  return { supabase, planId: data.id, matchId: data.match_id, teamId: m.team_id, format: m.match_format };
}

const revalidatePlan = (matchId: string, teamId: string) => {
  revalidatePath(`/app/matches/${matchId}/plan`);
  revalidatePath(`/app/teams/${teamId}/matches`);
};

// --- Fixtures (MATCH-01) --------------------------------------------------------

export async function createMatch(teamId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  if (!uuid.safeParse(teamId).success) return NOT_FOUND;
  const raw = matchValues(fd);
  const parsed = matchSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsOf(parsed.error), values: raw };

  const supabase = await createClient();
  const { data: team } = await supabase.from("teams").select("match_format").eq("id", teamId).maybeSingle();
  if (!team) return NOT_FOUND;
  const { opponentName, date, time, timeZone, venue } = parsed.data;
  const { data: match, error } = await supabase
    .from("matches")
    .insert({
      team_id: teamId,
      opponent_name: opponentName,
      kickoff_at: zonedTimeToUtc(date, time, timeZone).toISOString(),
      kickoff_tz: timeZone,
      venue,
      match_format: team.match_format,
    })
    .select("id")
    .single();
  if (error) return { status: "error", message: "Couldn't create the fixture. Try again.", values: raw };
  // A missing plan is recreated on first open (getPlanView), so this failure isn't fatal.
  await supabase.from("match_plans").insert({ match_id: match.id });
  await track("match_plan_created", teamId, { format: team.match_format, sections_count: 0 });

  revalidatePath(`/app/teams/${teamId}/matches`);
  revalidatePath("/app/teams");
  redirect(`/app/matches/${match.id}/plan`);
}

export async function updateMatch(matchId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  if (!uuid.safeParse(matchId).success) return NOT_FOUND;
  const raw = matchValues(fd);
  const parsed = matchSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsOf(parsed.error), values: raw };
  const { opponentName, date, time, timeZone, venue } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("matches")
    .update({ opponent_name: opponentName, kickoff_at: zonedTimeToUtc(date, time, timeZone).toISOString(), kickoff_tz: timeZone, venue })
    .eq("id", matchId)
    .select("team_id");
  if (error) return { status: "error", message: "Couldn't save the fixture. Try again.", values: raw };
  if (!data.length) return NOT_FOUND;
  revalidatePlan(matchId, data[0].team_id);
  revalidatePath("/app/teams");
  return { status: "success", message: "Fixture saved." };
}

export async function deleteMatch(matchId: string): Promise<ActionState> {
  await requireUser();
  if (!uuid.safeParse(matchId).success) return NOT_FOUND;
  const supabase = await createClient();
  const { data, error } = await supabase.from("matches").delete().eq("id", matchId).select("team_id");
  if (error) return { status: "error", message: "Couldn't delete the fixture." };
  if (!data.length) return NOT_FOUND;
  revalidatePath(`/app/teams/${data[0].team_id}/matches`);
  revalidatePath("/app/teams");
  redirect(`/app/teams/${data[0].team_id}/matches`);
}

// --- Lineup (MATCH-02) -------------------------------------------------------------

export async function saveLineup(planId: string, entries: LineupEntry[]): Promise<Result> {
  await requireUser();
  if (!uuid.safeParse(planId).success) return { status: "error", message: "Invalid request." };
  const ctx = await planContext(planId);
  if (!ctx) return { status: "error", message: "That plan no longer exists." };
  const parsed = lineupSchema(ctx.format).safeParse(entries);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };

  // Squad check: players must be this team's, and newly picked players must be active (US-02).
  const ids = parsed.data.map((e) => e.playerId);
  if (ids.length) {
    const [{ data: players }, { data: current }] = await Promise.all([
      ctx.supabase.from("players").select("id, archived_at").eq("team_id", ctx.teamId).in("id", ids),
      ctx.supabase.from("lineup_assignments").select("player_id").eq("plan_id", planId),
    ]);
    const existing = new Set((current ?? []).map((c) => c.player_id));
    const byId = new Map((players ?? []).map((p) => [p.id, p]));
    for (const id of ids) {
      const p = byId.get(id);
      if (!p) return { status: "error", message: "A selected player isn't in this squad." };
      if (p.archived_at && !existing.has(id)) return { status: "error", message: "Archived players can't be added to a lineup." };
    }
  }

  // Starters keep an explicit formation slot when given (pitch builder), otherwise get slots in
  // the order given; bench has none. Role, duty and instruction only apply to starters.
  const starters = parsed.data.filter((e) => e.role === "starter");
  const explicit = starters.every((e) => e.slot) && new Set(starters.map((e) => e.slot)).size === starters.length && starters.every((e) => e.slot! <= ctx.format);
  let next = 0;
  const payload = parsed.data.map((e) => {
    if (e.role === "bench") return { playerId: e.playerId, role: e.role, slot: null, position: "" };
    const role = roleByKey(e.playerRole);
    return {
      playerId: e.playerId,
      role: e.role,
      slot: explicit ? e.slot! : ++next,
      position: e.position ?? "",
      playerRole: role?.key ?? "",
      duty: role && e.duty && role.duties.includes(e.duty as Duty) ? e.duty : "",
      instruction: e.instruction ?? "",
    };
  });
  const { error } = await ctx.supabase.rpc("save_lineup", { p_plan_id: planId, p_lineup: payload });
  if (error) {
    return { status: "error", message: error.code === "23514" ? error.message : "Couldn't save the lineup. Your picks are still here; try again." };
  }
  revalidatePlan(ctx.matchId, ctx.teamId);
  return { status: "saved" };
}

// --- Plan & sections (PLAN-01) --------------------------------------------------------

export async function updateObjective(planId: string, objective: string): Promise<Result> {
  await requireUser();
  const parsed = objectiveSchema.safeParse(objective);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };
  if (!uuid.safeParse(planId).success) return { status: "error", message: "Invalid request." };
  const ctx = await planContext(planId);
  if (!ctx) return { status: "error", message: "That plan no longer exists." };
  const { error } = await ctx.supabase.from("match_plans").update({ objective: parsed.data || null }).eq("id", planId);
  if (error) return { status: "error", message: "Couldn't save the objective." };
  revalidatePlan(ctx.matchId, ctx.teamId);
  return { status: "saved" };
}

/** Enhancement 2: the formation the pitch builder lays starters out in (null = free list). */
export async function updateFormation(planId: string, formationId: string | null): Promise<Result> {
  await requireUser();
  if (!uuid.safeParse(planId).success) return { status: "error", message: "Invalid request." };
  const ctx = await planContext(planId);
  if (!ctx) return { status: "error", message: "That plan no longer exists." };
  if (formationId && !FORMATIONS.some((f) => f.id === formationId && f.format === ctx.format)) return { status: "error", message: "That formation doesn't fit this format." };
  const { error } = await ctx.supabase.from("match_plans").update({ formation_id: formationId }).eq("id", planId);
  if (error) return { status: "error", message: "Couldn't save the formation." };
  revalidatePlan(ctx.matchId, ctx.teamId);
  return { status: "saved" };
}

async function squadOf(ctx: NonNullable<Awaited<ReturnType<typeof planContext>>>) {
  const { data } = await ctx.supabase.from("lineup_assignments").select("player_id, role").eq("plan_id", ctx.planId);
  return {
    starters: new Set((data ?? []).filter((r) => r.role === "starter").map((r) => r.player_id)),
    all: new Set((data ?? []).map((r) => r.player_id)),
  };
}

/** Enhancement 4: set-piece takers and marking jobs. Every player must currently be a starter. */
export async function saveSetPieces(planId: string, input: unknown): Promise<Result> {
  await requireUser();
  if (!uuid.safeParse(planId).success) return { status: "error", message: "Invalid request." };
  const parsed = setPiecesSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };
  const ctx = await planContext(planId);
  if (!ctx) return { status: "error", message: "That plan no longer exists." };
  const { starters } = await squadOf(ctx);
  const ids = [...SET_PIECE_JOBS.flatMap((j) => parsed.data[j] ?? []), ...parsed.data.marking.map((m) => m.playerId)];
  if (ids.some((id) => !starters.has(id))) return { status: "error", message: "Set-piece jobs can only go to starters." };
  const { error } = await ctx.supabase.from("match_plans").update({ set_pieces: parsed.data }).eq("id", planId);
  if (error) return { status: "error", message: "Couldn't save set pieces." };
  revalidatePlan(ctx.matchId, ctx.teamId);
  return { status: "saved" };
}

/** Enhancement 5: substitution plan. Players must be in the match squad; timing problems are shown as warnings, not errors. */
export async function saveSubPlan(planId: string, input: unknown): Promise<Result> {
  await requireUser();
  if (!uuid.safeParse(planId).success) return { status: "error", message: "Invalid request." };
  const parsed = subPlanSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };
  if (parsed.data.subs.some((s) => s.minute >= parsed.data.matchLength)) return { status: "error", message: "Subs must happen before the final whistle." };
  const ctx = await planContext(planId);
  if (!ctx) return { status: "error", message: "That plan no longer exists." };
  const { all } = await squadOf(ctx);
  if (parsed.data.subs.some((s) => !all.has(s.outId) || !all.has(s.inId))) return { status: "error", message: "Subs can only involve players in the lineup or on the bench." };
  const { error } = await ctx.supabase.from("match_plans").update({ sub_plan: parsed.data }).eq("id", planId);
  if (error) return { status: "error", message: "Couldn't save the sub plan." };
  revalidatePlan(ctx.matchId, ctx.teamId);
  return { status: "saved" };
}

const DEFAULT_TITLES: Record<SectionType, string> = { board: "Tactic", notes: "Coaching notes", reminders: "Final reminders" };

export async function addSection(planId: string, type: SectionType, tacticId?: string): Promise<Result> {
  await requireUser();
  if (!uuid.safeParse(planId).success || !SECTION_TYPES.includes(type)) return { status: "error", message: "Invalid request." };
  if (type === "board" && !uuid.safeParse(tacticId).success) return { status: "error", message: "Choose a tactic to attach." };
  const ctx = await planContext(planId);
  if (!ctx) return { status: "error", message: "That plan no longer exists." };

  let title = DEFAULT_TITLES[type];
  if (type === "board") {
    const { data: t } = await ctx.supabase.from("tactics").select("name").eq("id", tacticId!).eq("team_id", ctx.teamId).maybeSingle();
    if (!t) return { status: "error", message: "That tactic isn't in this team's library." };
    title = t.name.slice(0, 80);
  }
  const { data: last } = await ctx.supabase
    .from("plan_sections")
    .select("sort_order")
    .eq("plan_id", planId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const { error } = await ctx.supabase.from("plan_sections").insert({
    plan_id: planId,
    section_type: type,
    title,
    tactic_id: type === "board" ? tacticId : null,
    sort_order: (last?.[0]?.sort_order ?? -1) + 1,
    content_json: { phase: "general", notes: "", privateNotes: "" },
  });
  if (error) return { status: "error", message: "Couldn't add the section." };
  revalidatePlan(ctx.matchId, ctx.teamId);
  return { status: "saved" };
}

export async function updateSection(sectionId: string, data: unknown): Promise<Result> {
  await requireUser();
  if (!uuid.safeParse(sectionId).success) return { status: "error", message: "Invalid request." };
  const parsed = sectionUpdate.safeParse(data);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("plan_sections")
    .update({ title: parsed.data.title, content_json: parsed.data.content, include_in_briefing: parsed.data.includeInBriefing })
    .eq("id", sectionId)
    .select("plan_id");
  if (error) return { status: "error", message: "Couldn't save the section." };
  if (!rows.length) return { status: "error", message: "That section no longer exists." };
  const ctx = await planContext(rows[0].plan_id);
  if (ctx) revalidatePlan(ctx.matchId, ctx.teamId);
  return { status: "saved" };
}

export async function moveSection(sectionId: string, delta: -1 | 1): Promise<Result> {
  await requireUser();
  if (!uuid.safeParse(sectionId).success || (delta !== -1 && delta !== 1)) return { status: "error", message: "Invalid request." };
  const supabase = await createClient();
  const { data: s } = await supabase.from("plan_sections").select("plan_id").eq("id", sectionId).maybeSingle();
  if (!s) return { status: "error", message: "That section no longer exists." };
  const { error } = await supabase.rpc("move_plan_section", { p_section_id: sectionId, p_delta: delta });
  if (error) return { status: "error", message: "Couldn't reorder." };
  const ctx = await planContext(s.plan_id);
  if (ctx) revalidatePlan(ctx.matchId, ctx.teamId);
  return { status: "saved" };
}

export async function deleteSection(sectionId: string): Promise<Result> {
  await requireUser();
  if (!uuid.safeParse(sectionId).success) return { status: "error", message: "Invalid request." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("plan_sections").delete().eq("id", sectionId).select("plan_id");
  if (error || !data.length) return { status: "error", message: "Couldn't remove the section." };
  const ctx = await planContext(data[0].plan_id);
  if (ctx) revalidatePlan(ctx.matchId, ctx.teamId);
  return { status: "saved" };
}
