import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { TeamNav } from "@/components/teams/team-nav";
import { formatLabel } from "@/lib/domain/format";
import { getTeam } from "@/lib/db/teams";

export default async function TeamLayout({ children, params }: LayoutProps<"/app/teams/[teamId]">) {
  const { teamId } = await params;
  const team = await getTeam(teamId);
  return (
    <>
      <PageHeader
        eyebrow={<Link href="/app/teams" className="hover:underline">Your teams</Link>}
        title={
          <span className="flex items-center gap-3">
            <span aria-hidden className="size-6 shrink-0 rounded-md ring-1 ring-black/10" style={{ backgroundColor: team.primaryColor }} />
            <span className="truncate">{team.name}</span>
          </span>
        }
        description={formatLabel(team.matchFormat)}
      />
      <TeamNav teamId={team.id} />
      {children}
    </>
  );
}
