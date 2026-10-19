import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { buttonVariants } from "@/components/ui/button";
import { formatLabel } from "@/lib/domain/format";
import { listTeams } from "@/lib/db/teams";
import { nextMatches } from "@/lib/db/matches";

export const metadata: Metadata = { title: "Your teams · Touchline" };

export default async function TeamsPage() {
  const teams = await listTeams();
  const next = await nextMatches(teams.map((t) => t.id));

  if (teams.length === 0) {
    return (
      <>
        <PageHeader title="Your teams" />
        <EmptyState
          icon={<Users className="size-10" aria-hidden />}
          title="Set up your first team"
          description="Add your squad once, then reuse it for every lineup, tactic and matchday briefing."
          action={
            <Link href="/app/teams/new" className={buttonVariants({ size: "lg" })}>
              <Plus aria-hidden /> Create a team
            </Link>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Your teams"
        actions={
          <Link href="/app/teams/new" className={buttonVariants()}>
            <Plus aria-hidden /> New team
          </Link>
        }
      />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {teams.map((t) => (
          <li key={t.id} className="min-w-0">
            <Link
              href={`/app/teams/${t.id}`}
              className="group flex h-full flex-col rounded-2xl border bg-card p-5 shadow-xs transition hover:border-primary/40 hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <div className="flex items-center gap-3">
                <span aria-hidden className="size-9 shrink-0 rounded-lg ring-1 ring-black/10" style={{ backgroundColor: t.primaryColor }} />
                <div className="min-w-0">
                  <h2 className="truncate font-semibold group-hover:text-primary">{t.name}</h2>
                  <p className="text-sm text-muted-foreground">{formatLabel(t.matchFormat)}</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                {t.activePlayers === 0 ? "No players yet" : `${t.activePlayers} player${t.activePlayers === 1 ? "" : "s"}`}
              </p>
              <p className="mt-1 truncate text-sm">
                {next[t.id] ? (
                  <>
                    <span className="text-muted-foreground">Next: </span>vs {next[t.id].opponentName} ·{" "}
                    {next[t.id].kickoffShortLabel}
                  </>
                ) : (
                  <span className="text-muted-foreground">No upcoming fixture</span>
                )}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
