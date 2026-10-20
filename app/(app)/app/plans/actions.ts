"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/supabase/env";
import { loadPlanForPublishing } from "@/lib/db/publications";
import { buildSlides } from "@/lib/domain/slides";
import type { Snapshot } from "@/lib/domain/snapshot";
import { SET_PIECE_JOBS } from "@/lib/validation/match";
import { generateShareToken, hashShareToken, shareUrl } from "@/lib/share/token";
import { track } from "@/lib/analytics/track";

type PublishResult =
  | { status: "published"; url: string }
  | { status: "republished" }
  | { status: "blocked"; reasons: string[] }
  | { status: "error"; message: string };

const uuid = z.uuid();

async function audit(teamId: string, action: "plan_published" | "plan_republished" | "share_revoked" | "share_rotated", publicationId: string) {
  const supabase = await createClient();
  // Best effort: an audit failure never blocks the owner's action.
  await supabase.from("audit_events").insert({ team_id: teamId, action, resource_type: "published_plan", resource_id: publicationId });
}

function refresh(planId: string, matchId: string) {
  revalidatePath(`/app/plans/${planId}/publish`);
  revalidatePath(`/app/matches/${matchId}/plan`);
}

/** Counts only: never names, roles text or instructions (PLAN-004 §5). */
function publishProps(s: Snapshot, slideCount: number) {
  return {
    slide_count: slideCount,
    format: s.match.format,
    has_formation: s.lineup.formation ? (1 as const) : (0 as const),
    roles_count: s.lineup.starters.filter((p) => p.role).length,
    set_piece_jobs: s.setPieces ? SET_PIECE_JOBS.filter((j) => s.setPieces![j]).length + s.setPieces.marking.length : 0,
    subs_count: s.subPlan?.subs.length ?? 0,
  };
}

/**
 * Publish (or republish) a plan as an immutable snapshot (PRES-02, ADR-03/05). Readiness is
 * re-checked here on the server; the client checklist is only a guide.
 */
export async function publishPlan(planId: string): Promise<PublishResult> {
  await requireUser();
  if (!uuid.safeParse(planId).success) return { status: "error", message: "Invalid request." };
  const { view, readiness, publication, draft } = await loadPlanForPublishing(planId);
  if (!readiness.ready) return { status: "blocked", reasons: readiness.items.filter((i) => i.level === "blocking").map((i) => i.message) };

  const snapshot = draft(new Date().toISOString());
  const slideCount = buildSlides(snapshot).length;
  const supabase = await createClient();

  if (publication) {
    // Republish keeps the same link; players see the new version next time they open it.
    const { error } = await supabase
      .from("published_plans")
      .update({ snapshot_json: snapshot, slide_count: slideCount, published_at: snapshot.publishedAt })
      .eq("id", publication.id)
      .is("revoked_at", null);
    if (error) return { status: "error", message: "Couldn't republish. Your draft is unchanged; try again." };
    await audit(view.match.teamId, "plan_republished", publication.id);
    await track("plan_published", view.match.teamId, publishProps(snapshot, slideCount));
    refresh(planId, view.match.id);
    return { status: "republished" };
  }

  const token = generateShareToken();
  const { data, error } = await supabase
    .from("published_plans")
    .insert({ plan_id: planId, share_token_hash: hashShareToken(token), snapshot_json: snapshot, slide_count: slideCount })
    .select("id")
    .single();
  if (error) return { status: "error", message: "Couldn't publish. Your draft is unchanged; try again." };
  await audit(view.match.teamId, "plan_published", data.id);
  await track("plan_published", view.match.teamId, publishProps(snapshot, slideCount));
  refresh(planId, view.match.id);
  return { status: "published", url: shareUrl(siteUrl(), token) };
}

export async function revokeLink(planId: string): Promise<{ status: "revoked" } | { status: "error"; message: string }> {
  await requireUser();
  if (!uuid.safeParse(planId).success) return { status: "error", message: "Invalid request." };
  const { view, publication } = await loadPlanForPublishing(planId);
  if (!publication) return { status: "error", message: "There's no live link to revoke." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("published_plans")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", publication.id)
    .is("revoked_at", null)
    .select("id");
  if (error || !data.length) return { status: "error", message: "Couldn't revoke the link. Try again." };
  await audit(view.match.teamId, "share_revoked", publication.id);
  await track("share_revoked", view.match.teamId, { link_age_days: Math.floor((Date.now() - new Date(publication.publishedAt).getTime()) / 86_400_000) });
  refresh(planId, view.match.id);
  return { status: "revoked" };
}

/** Lost the link? Issue a new token for the same published snapshot; the old link stops working. */
export async function rotateLink(planId: string): Promise<{ status: "rotated"; url: string } | { status: "error"; message: string }> {
  await requireUser();
  if (!uuid.safeParse(planId).success) return { status: "error", message: "Invalid request." };
  const { view, publication } = await loadPlanForPublishing(planId);
  if (!publication) return { status: "error", message: "Publish the plan first." };
  const supabase = await createClient();
  const { error: revokeErr } = await supabase.from("published_plans").update({ revoked_at: new Date().toISOString() }).eq("id", publication.id).is("revoked_at", null);
  if (revokeErr) return { status: "error", message: "Couldn't create a new link. Try again." };
  const token = generateShareToken();
  const { data, error } = await supabase
    .from("published_plans")
    .insert({ plan_id: planId, share_token_hash: hashShareToken(token), snapshot_json: publication.snapshot, slide_count: publication.slideCount })
    .select("id")
    .single();
  if (error) return { status: "error", message: "The old link was revoked but a new one couldn't be created. Publish again to get a link." };
  await audit(view.match.teamId, "share_rotated", data.id);
  refresh(planId, view.match.id);
  return { status: "rotated", url: shareUrl(siteUrl(), token) };
}
