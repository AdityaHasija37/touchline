import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Pseudonymous product analytics (PLAN-004 §5). Only these properties exist; the database
 * rejects anything else, so names, notes, emails, tokens and board JSON can't be recorded.
 * Best effort: never throws, never blocks the user's action.
 */
type Events = {
  team_created: { format: number };
  player_added: Record<string, never>;
  tactic_saved: { format: number; object_count: number };
  match_plan_created: { format: number; sections_count: number };
  plan_published: { slide_count: number; format: number };
  presentation_opened: { viewer_type: "owner"; slide_count: number };
  pdf_exported: { viewer_type: "owner"; slide_count: number; latency_ms: number };
  share_revoked: { link_age_days: number };
};

export async function track<E extends keyof Events>(event: E, teamId: string, props: Events[E]): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.rpc("track_event", { p_event: event, p_team_id: teamId, p_props: props });
  } catch {
    // Analytics must never affect the product.
  }
}
