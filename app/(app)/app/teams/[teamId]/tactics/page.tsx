import type { Metadata } from "next";
import { getTeam } from "@/lib/db/teams";
import { listTactics } from "@/lib/db/tactics";
import { formationsFor } from "@/lib/domain/formations";
import { TacticsLibrary } from "@/components/tactics/tactics-library";

export async function generateMetadata({ params }: PageProps<"/app/teams/[teamId]/tactics">): Promise<Metadata> {
  const team = await getTeam((await params).teamId);
  return { title: `Tactics · ${team.name} · Touchline` };
}

export default async function TacticsPage({ params }: PageProps<"/app/teams/[teamId]/tactics">) {
  const { teamId } = await params;
  const team = await getTeam(teamId);
  const tactics = await listTactics(teamId);
  return <TacticsLibrary team={team} tactics={tactics} formations={formationsFor(team.matchFormat)} />;
}
