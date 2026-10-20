import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getPlanView, type PlanView } from "@/lib/db/matches";
import { getTeam, listPlayers, type Team } from "@/lib/db/teams";
import { buildSnapshot, snapshotSchema, type Snapshot } from "@/lib/domain/snapshot";
import { planReadiness } from "@/lib/domain/plan-readiness";
import { computeMinutes } from "@/lib/domain/minutes";
import { positionFit } from "@/lib/domain/roles";

export type Publication = { id: string; snapshot: Snapshot; slideCount: number; publishedAt: string };

/** Everything the publish screen and actions need, for the plan's owner only. */
export const loadPlanForPublishing = cache(async (planId: string) => {
  if (!z.uuid().safeParse(planId).success) notFound();
  const supabase = await createClient();
  const { data: plan } = await supabase.from("match_plans").select("match_id").eq("id", planId).maybeSingle();
  if (!plan) notFound();
  const view: PlanView = await getPlanView(plan.match_id);
  const [team, players, { data: pub }] = await Promise.all([
    getTeam(view.match.teamId),
    listPlayers(view.match.teamId),
    supabase.from("published_plans").select("id, snapshot_json, slide_count, published_at").eq("plan_id", planId).is("revoked_at", null).maybeSingle(),
  ]);
  const parsed = pub ? snapshotSchema.safeParse(pub.snapshot_json) : null;
  const publication: Publication | null =
    pub && parsed?.success ? { id: pub.id, snapshot: parsed.data, slideCount: pub.slide_count, publishedAt: pub.published_at } : null;

  const byId = new Map(players.map((p) => [p.id, p]));
  const readiness = planReadiness({
    format: view.match.format,
    starters: view.lineup.filter((l) => l.role === "starter").map((l) => ({ archived: Boolean(byId.get(l.playerId)?.archivedAt) })),
    sections: view.sections.map((s) => ({ title: s.title, type: s.type, included: s.includeInBriefing, hasTactic: Boolean(s.tactic), tacticFormat: s.tactic?.format ?? null })),
    objective: view.plan.objective,
    outOfPosition: view.plan.formationId
      ? view.lineup.filter((l) => l.role === "starter" && positionFit(byId.get(l.playerId)?.preferredPositions ?? [], l.position) === "out").length
      : 0,
    ...subWarnings(view),
  });

  return { view, team, players, publication, readiness, draft: (publishedAt: string) => draftSnapshot(view, team, players, publishedAt) };
});

function subWarnings(view: PlanView) {
  const sp = view.plan.subPlan;
  if (!sp?.subs.length) return {};
  const ids = (role: string) => view.lineup.filter((l) => l.role === role).map((l) => l.playerId);
  const r = computeMinutes(ids("starter"), ids("bench"), sp.subs.map((s) => ({ minute: s.minute, outKey: s.outId, inKey: s.inId })), sp.matchLength);
  return { subProblems: r.problems.filter(Boolean).length, shortMinutes: r.short.length };
}

export function draftSnapshot(view: PlanView, team: Team, players: Awaited<ReturnType<typeof listPlayers>>, publishedAt: string): Snapshot {
  return buildSnapshot({
    publishedAt,
    team: { name: team.name, primaryColor: team.primaryColor },
    match: {
      opponentName: view.match.opponentName,
      kickoffAt: view.match.kickoffAt,
      kickoffLabel: view.match.kickoffLabel,
      venue: view.match.venue,
      format: view.match.format,
    },
    objective: view.plan.objective,
    formationId: view.plan.formationId,
    lineup: view.lineup,
    setPieces: view.plan.setPieces,
    subPlan: view.plan.subPlan,
    players: players.map((p) => ({ id: p.id, name: p.name, shirtNumber: p.shirtNumber })),
    sections: view.sections,
  });
}
