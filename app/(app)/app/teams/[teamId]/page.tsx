import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { TeamForm } from "@/components/teams/team-form";
import { DeleteTeam } from "@/components/teams/delete-team";
import { getTeam, listPlayers } from "@/lib/db/teams";
import { deleteTeam, updateTeam } from "../actions";

export async function generateMetadata({ params }: PageProps<"/app/teams/[teamId]">): Promise<Metadata> {
  const team = await getTeam((await params).teamId);
  return { title: `${team.name} · Touchline` };
}

export default async function TeamOverviewPage({ params }: PageProps<"/app/teams/[teamId]">) {
  const { teamId } = await params;
  const team = await getTeam(teamId);
  const players = await listPlayers(teamId);
  const active = players.filter((p) => !p.archivedAt).length;
  const short = Math.max(0, team.matchFormat - active);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <section aria-labelledby="settings-heading" className="min-w-0 rounded-2xl border bg-card p-5 sm:p-8">
        <h2 id="settings-heading" className="mb-6 text-lg font-semibold">Team details</h2>
        <TeamForm
          action={updateTeam.bind(null, team.id)}
          defaults={team}
          submitLabel="Save changes"
          pendingLabel="Saving…"
          formatWarning="Changing format won't alter any briefing you've already published."
        />
      </section>

      <aside className="grid min-w-0 content-start gap-6">
        <section aria-labelledby="squad-heading" className="rounded-2xl border bg-card p-5">
          <h2 id="squad-heading" className="font-semibold">Squad</h2>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{active}</p>
          <p className="text-sm text-muted-foreground">
            {short > 0
              ? `Add ${short} more to field a full ${team.matchFormat}.`
              : `Enough for a full ${team.matchFormat}-a-side lineup.`}
          </p>
          <Link href={`/app/teams/${team.id}/squad`} className={buttonVariants({ variant: "outline", className: "mt-4 w-full" })}>
            Manage squad
          </Link>
        </section>

        <DeleteTeam teamName={team.name} playerCount={players.length} action={deleteTeam.bind(null, team.id)} />
      </aside>
    </div>
  );
}
