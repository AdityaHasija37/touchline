import type { Metadata } from "next";
import { TacticEditor } from "@/components/tactics/editor/tactic-editor";
import { getTactic } from "@/lib/db/tactics";
import { getTeam, listPlayers } from "@/lib/db/teams";

export async function generateMetadata({ params }: PageProps<"/app/tactics/[tacticId]">): Promise<Metadata> {
  const tactic = await getTactic((await params).tacticId);
  return { title: `${tactic.name} · Touchline` };
}

export default async function TacticEditorPage({ params }: PageProps<"/app/tactics/[tacticId]">) {
  const { tacticId } = await params;
  const tactic = await getTactic(tacticId);
  const [team, players] = await Promise.all([getTeam(tactic.teamId), listPlayers(tactic.teamId)]);
  return (
    <TacticEditor
      // Remount on a fresh server version (e.g. after "reload") so local state never mixes versions.
      key={`${tactic.id}:${tactic.version}`}
      tactic={tactic}
      team={{ id: team.id, name: team.name, primaryColor: team.primaryColor }}
      players={players}
    />
  );
}
