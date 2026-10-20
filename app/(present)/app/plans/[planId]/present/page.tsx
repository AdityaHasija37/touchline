import type { Metadata } from "next";
import { Viewer } from "@/components/slides/viewer";
import { loadPlanForPublishing } from "@/lib/db/publications";
import { buildSlides } from "@/lib/domain/slides";
import { track } from "@/lib/analytics/track";

export const metadata: Metadata = { title: "Present · Touchline" };

/** Owner presenter. Shows the published briefing; `?source=draft` (or no publication yet) previews the draft. */
export default async function PresentPage({ params, searchParams }: PageProps<"/app/plans/[planId]/present">) {
  const { planId } = await params;
  const { source } = await searchParams;
  const { view, team, publication, draft } = await loadPlanForPublishing(planId);
  const useDraft = source === "draft" || !publication;
  const snapshot = useDraft ? draft(new Date(0).toISOString()) : publication!.snapshot;
  const slides = buildSlides(snapshot);
  if (!useDraft) await track("presentation_opened", team.id, { viewer_type: "owner", slide_count: slides.length });
  return (
    <Viewer
      slides={slides}
      teamColor={team.primaryColor}
      matchLabel={`${team.name} vs ${view.match.opponentName}`}
      exitHref={`/app/plans/${planId}/publish`}
      banner={
        useDraft ? (
          <p role="status" className="mx-4 mb-2 rounded-md bg-amber-500/15 px-3 py-1.5 text-center text-sm text-amber-200 sm:mx-6">
            Draft preview, not what players see.{publication ? "" : " This plan isn't published yet."}
          </p>
        ) : undefined
      }
    />
  );
}
