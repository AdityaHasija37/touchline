import type { Metadata } from "next";
import { SquadManager } from "@/components/teams/squad-manager";
import { getTeam, listPlayers } from "@/lib/db/teams";

export async function generateMetadata({ params }: PageProps<"/app/teams/[teamId]/squad">): Promise<Metadata> {
  const team = await getTeam((await params).teamId);
  return { title: `Squad · ${team.name} · Touchline` };
}

export default async function SquadPage({ params }: PageProps<"/app/teams/[teamId]/squad">) {
  const { teamId } = await params;
  const team = await getTeam(teamId);
  const players = await listPlayers(teamId);
  return <SquadManager teamId={team.id} matchFormat={team.matchFormat} players={players} />;
}
