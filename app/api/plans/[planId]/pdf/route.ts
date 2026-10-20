import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { snapshotSchema } from "@/lib/domain/snapshot";
import { pdfFilename, renderBriefingPdf } from "@/lib/pdf/briefing-pdf";
import { buildSlides } from "@/lib/domain/slides";
import { track } from "@/lib/analytics/track";

export const runtime = "nodejs";

/** EXP-01 owner export: the published briefing as a PDF. RLS scopes the lookup to the owner. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/plans/[planId]/pdf">) {
  const { planId } = await ctx.params;
  const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!z.uuid().safeParse(planId).success) return notFound();

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ error: "Sign in first" }, { status: 401, headers: { "Cache-Control": "no-store" } });

  const { data } = await supabase
    .from("published_plans")
    .select("snapshot_json, match_plans(matches(team_id))")
    .eq("plan_id", planId)
    .is("revoked_at", null)
    .maybeSingle();
  const parsed = data ? snapshotSchema.safeParse(data.snapshot_json) : null;
  if (!parsed?.success) return notFound();

  const started = Date.now();
  const pdf = await renderBriefingPdf(parsed.data);
  const teamId = (data!.match_plans as unknown as { matches: { team_id: string } }).matches.team_id;
  await track("pdf_exported", teamId, { viewer_type: "owner", slide_count: buildSlides(parsed.data).length, latency_ms: Date.now() - started });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pdfFilename(parsed.data)}"`,
      "Cache-Control": "no-store",
    },
  });
}
