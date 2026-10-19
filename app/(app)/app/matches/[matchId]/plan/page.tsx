import type { Metadata } from "next";
import { PlanEditor } from "@/components/matches/plan-editor";
import { getPlanView } from "@/lib/db/matches";
import { listTactics } from "@/lib/db/tactics";
import { getTeam, listPlayers } from "@/lib/db/teams";

export async function generateMetadata({ params }: PageProps<"/app/matches/[matchId]/plan">): Promise<Metadata> {
  const view = await getPlanView((await params).matchId);
  return { title: `vs ${view.match.opponentName} · Match plan · Touchline` };
}

export default async function PlanPage({ params }: PageProps<"/app/matches/[matchId]/plan">) {
  const { matchId } = await params;
  const view = await getPlanView(matchId);
  const [team, players, tactics] = await Promise.all([getTeam(view.match.teamId), listPlayers(view.match.teamId), listTactics(view.match.teamId)]);
  return (
    <PlanEditor
      // Remount the lineup's local state when the server lineup changes underneath (e.g. other tab).
      key={view.plan.id}
      view={view}
      team={{ id: team.id, name: team.name, primaryColor: team.primaryColor }}
      players={players}
      tactics={tactics}
    />
  );
}
