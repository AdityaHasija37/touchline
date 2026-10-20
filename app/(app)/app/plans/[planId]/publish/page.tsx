import type { Metadata } from "next";
import { PublishPanel } from "@/components/publish/publish-panel";
import { loadPlanForPublishing } from "@/lib/db/publications";
import { buildSlides } from "@/lib/domain/slides";
import { snapshotFingerprint } from "@/lib/domain/snapshot";

export const metadata: Metadata = { title: "Preview & publish · Touchline" };

export default async function PublishPage({ params }: PageProps<"/app/plans/[planId]/publish">) {
  const { planId } = await params;
  const { view, team, publication, readiness, draft } = await loadPlanForPublishing(planId);
  const draftSnap = draft(new Date(0).toISOString());
  const changed = publication ? snapshotFingerprint(publication.snapshot) !== snapshotFingerprint(draftSnap) : false;
  return (
    <PublishPanel
      planId={planId}
      matchId={view.match.id}
      teamId={team.id}
      teamColor={team.primaryColor}
      title={`vs ${view.match.opponentName}`}
      kickoffLabel={view.match.kickoffLabel}
      slides={buildSlides(draftSnap)}
      excludedTitles={view.sections.filter((s) => !s.includeInBriefing).map((s) => s.title)}
      readiness={readiness}
      publication={publication ? { publishedAt: publication.publishedAt, slideCount: publication.slideCount, changed } : null}
    />
  );
}
