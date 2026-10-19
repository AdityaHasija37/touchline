"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarPlus, MapPin } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createMatch } from "@/app/(app)/app/matches/actions";
import type { MatchSummary } from "@/lib/db/matches";
import { MatchForm } from "./match-form";

export function MatchList({ teamId, upcoming, past }: { teamId: string; upcoming: MatchSummary[]; past: MatchSummary[] }) {
  const [creating, setCreating] = useState(false);
  const none = upcoming.length + past.length === 0;

  return (
    <>
      {none ? (
        <EmptyState
          icon={<CalendarPlus className="size-10" aria-hidden />}
          title="No fixtures yet"
          description="Add your next match to pick a lineup and build the briefing."
          action={
            <Button size="lg" onClick={() => setCreating(true)}>
              <CalendarPlus aria-hidden /> Add fixture
            </Button>
          }
        />
      ) : (
        <div className="grid gap-8">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {upcoming.length} upcoming · {past.length} past
            </p>
            <Button onClick={() => setCreating(true)}>
              <CalendarPlus aria-hidden /> Add fixture
            </Button>
          </div>
          <FixtureGroup title="Upcoming" matches={upcoming} empty="No upcoming fixtures." />
          {past.length > 0 && <FixtureGroup title="Past" matches={past} />}
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add fixture</DialogTitle>
          </DialogHeader>
          <MatchForm action={createMatch.bind(null, teamId)} submitLabel="Add and plan it" pendingLabel="Adding…" />
        </DialogContent>
      </Dialog>
    </>
  );
}

function FixtureGroup({ title, matches, empty }: { title: string; matches: MatchSummary[]; empty?: string }) {
  return (
    <section aria-labelledby={`fixtures-${title}`}>
      <h2 id={`fixtures-${title}`} className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h2>
      {matches.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="grid gap-3" aria-label={`${title} fixtures`}>
          {matches.map((m) => {
            const full = m.starters === m.format;
            return (
              <li key={m.id} className="min-w-0">
                <Link
                  href={`/app/matches/${m.id}/plan`}
                  className="flex flex-col gap-2 rounded-2xl border bg-card p-4 shadow-xs transition hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">vs {m.opponentName}</p>
                    <p className="text-sm text-muted-foreground">{m.kickoffLabel}</p>
                    {m.venue && (
                      <p className="flex items-center gap-1 truncate text-sm text-muted-foreground">
                        <MapPin className="size-3.5 shrink-0" aria-hidden /> {m.venue}
                      </p>
                    )}
                  </div>
                  <Badge variant={full ? "default" : "secondary"} className="self-start sm:self-center">
                    {full ? "Lineup complete" : `${m.starters}/${m.format} starters`}
                  </Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
