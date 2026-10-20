import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { MatchFormat } from "@/lib/domain/format";
import { formatKickoff } from "@/lib/domain/time";
import { boardSchema, type Board } from "@/lib/validation/board";
import type { Duty } from "@/lib/domain/roles";
import { sectionContent, setPiecesSchema, subPlanSchema, type SectionContent, type SectionType, type SetPieces, type SubPlan } from "@/lib/validation/match";

export type MatchSummary = {
  id: string;
  teamId: string;
  opponentName: string;
  kickoffAt: string;
  kickoffTz: string;
  /** Formatted on the server only: ICU data differs between Node and browsers (hydration-safe). */
  kickoffLabel: string;
  kickoffShortLabel: string;
  venue: string | null;
  format: MatchFormat;
  status: "scheduled" | "played" | "cancelled";
  planId: string | null;
  starters: number;
};

export type PlanSection = {
  id: string;
  type: SectionType;
  title: string;
  content: SectionContent;
  includeInBriefing: boolean;
  sortOrder: number;
  tactic: { id: string; name: string; format: MatchFormat; board: Board | null } | null;
};

export type LineupRow = {
  playerId: string;
  role: "starter" | "bench";
  slot: number | null;
  position: string | null;
  playerRole: string | null;
  duty: Duty | null;
  instruction: string | null;
};

export type PlanView = {
  match: MatchSummary;
  plan: {
    id: string;
    objective: string | null;
    updatedAt: string;
    formationId: string | null;
    /** Stored JSON is re-validated on read; anything malformed falls back to empty. */
    setPieces: SetPieces;
    subPlan: SubPlan | null;
  };
  lineup: LineupRow[];
  sections: PlanSection[];
};

const PLAN_COLS = "id, objective, updated_at, formation_id, set_pieces, sub_plan";
const MATCH_COLS = "id, team_id, opponent_name, kickoff_at, kickoff_tz, venue, match_format, status";

type MatchRow = {
  id: string;
  team_id: string;
  opponent_name: string;
  kickoff_at: string;
  kickoff_tz: string;
  venue: string | null;
  match_format: number;
  status: string;
};

function toMatch(r: MatchRow, planId: string | null, starters: number): MatchSummary {
  return {
    id: r.id,
    teamId: r.team_id,
    opponentName: r.opponent_name,
    kickoffAt: r.kickoff_at,
    kickoffTz: r.kickoff_tz,
    kickoffLabel: formatKickoff(r.kickoff_at, r.kickoff_tz),
    kickoffShortLabel: formatKickoff(r.kickoff_at, r.kickoff_tz, { withZone: false, withYear: false }),
    venue: r.venue,
    format: r.match_format as MatchFormat,
    status: r.status as MatchSummary["status"],
    planId,
    starters,
  };
}

export async function listMatches(teamId: string): Promise<MatchSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("matches")
    .select(`${MATCH_COLS}, match_plans(id, lineup_assignments(role))`)
    .eq("team_id", teamId)
    .order("kickoff_at", { ascending: true });
  if (error) throw new Error("Couldn't load fixtures.");
  return data.map((r) => {
    const plan = (r.match_plans as unknown as { id: string; lineup_assignments: { role: string }[] } | null) ?? null;
    return toMatch(r as MatchRow, plan?.id ?? null, plan?.lineup_assignments.filter((l) => l.role === "starter").length ?? 0);
  });
}

/** Next scheduled fixture per team (dashboard, S01). */
export async function nextMatches(teamIds: string[]): Promise<Record<string, MatchSummary>> {
  if (!teamIds.length) return {};
  const supabase = await createClient();
  const { data } = await supabase
    .from("matches")
    .select(MATCH_COLS)
    .in("team_id", teamIds)
    .eq("status", "scheduled")
    .gte("kickoff_at", new Date(Date.now() - 3 * 3600_000).toISOString())
    .order("kickoff_at", { ascending: true });
  const out: Record<string, MatchSummary> = {};
  for (const r of (data ?? []) as MatchRow[]) out[r.team_id] ??= toMatch(r, null, 0);
  return out;
}

/** Full match plan for its owner; anything else is a generic 404. */
export const getPlanView = cache(async (matchId: string): Promise<PlanView> => {
  if (!z.uuid().safeParse(matchId).success) notFound();
  const supabase = await createClient();
  const { data: m } = await supabase.from("matches").select(MATCH_COLS).eq("id", matchId).maybeSingle();
  if (!m) notFound();

  let { data: plan } = await supabase.from("match_plans").select(PLAN_COLS).eq("match_id", matchId).maybeSingle();
  if (!plan) {
    // Every fixture has a plan; recreate defensively if an insert was ever interrupted.
    const { data } = await supabase.from("match_plans").insert({ match_id: matchId }).select(PLAN_COLS).single();
    plan = data;
  }
  if (!plan) notFound();

  const [{ data: lineup }, { data: sections }] = await Promise.all([
    supabase.from("lineup_assignments").select("player_id, role, formation_slot, position_label, player_role, duty, instruction").eq("plan_id", plan.id),
    supabase
      .from("plan_sections")
      .select("id, section_type, title, content_json, include_in_briefing, sort_order, tactics(id, name, format, board_json)")
      .eq("plan_id", plan.id)
      .order("sort_order"),
  ]);

  return {
    match: toMatch(m as MatchRow, plan.id, (lineup ?? []).filter((l) => l.role === "starter").length),
    plan: {
      id: plan.id,
      objective: plan.objective,
      updatedAt: plan.updated_at,
      formationId: plan.formation_id,
      setPieces: setPiecesSchema.safeParse(plan.set_pieces).data ?? { marking: [] },
      subPlan: subPlanSchema.safeParse(plan.sub_plan).data ?? null,
    },
    lineup: (lineup ?? []).map((l) => ({
      playerId: l.player_id,
      role: l.role as LineupRow["role"],
      slot: l.formation_slot,
      position: l.position_label,
      playerRole: l.player_role,
      duty: l.duty as Duty | null,
      instruction: l.instruction,
    })),
    sections: (sections ?? []).map((s) => {
      const t = s.tactics as unknown as { id: string; name: string; format: number; board_json: unknown } | null;
      const parsed = t ? boardSchema.safeParse(t.board_json) : null;
      return {
        id: s.id,
        type: s.section_type as SectionType,
        title: s.title,
        content: sectionContent.parse(s.content_json ?? {}),
        includeInBriefing: s.include_in_briefing,
        sortOrder: s.sort_order,
        tactic: t ? { id: t.id, name: t.name, format: t.format as MatchFormat, board: parsed?.success ? parsed.data : null } : null,
      };
    }),
  };
});

/** Fixtures split for S06: upcoming (until 3 h after kickoff, covering matchday) ascending, past newest first. */
export async function listFixtures(teamId: string): Promise<{ upcoming: MatchSummary[]; past: MatchSummary[] }> {
  const matches = await listMatches(teamId);
  const cutoff = Date.now() - 3 * 3600_000;
  return {
    upcoming: matches.filter((m) => new Date(m.kickoffAt).getTime() >= cutoff),
    past: matches.filter((m) => new Date(m.kickoffAt).getTime() < cutoff).reverse(),
  };
}
