import type { Metadata } from "next";
import { MatchList } from "@/components/matches/match-list";
import { listFixtures } from "@/lib/db/matches";
import { getTeam } from "@/lib/db/teams";

export async function generateMetadata({ params }: PageProps<"/app/teams/[teamId]/matches">): Promise<Metadata> {
  const team = await getTeam((await params).teamId);
  return { title: `Matches · ${team.name} · Touchline` };
}

export default async function MatchesPage({ params }: PageProps<"/app/teams/[teamId]/matches">) {
  const { teamId } = await params;
  const team = await getTeam(teamId);
  const { upcoming, past } = await listFixtures(team.id);
  return <MatchList teamId={team.id} upcoming={upcoming} past={past} />;
}
