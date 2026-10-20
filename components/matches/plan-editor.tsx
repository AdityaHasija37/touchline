"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, FileText, LayoutTemplate, ListChecks, MapPin, Pencil, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { BoardSvg } from "@/components/board/board-svg";
import { EmptyState } from "@/components/app/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { addSection, deleteMatch, updateMatch, updateObjective } from "@/app/(app)/app/matches/actions";
import type { LineupRow, PlanView } from "@/lib/db/matches";
import type { TacticSummary } from "@/lib/db/tactics";
import type { Player } from "@/lib/db/teams";
import { formatLabel } from "@/lib/domain/format";
import { planReadiness } from "@/lib/domain/plan-readiness";
import { toZonedParts } from "@/lib/domain/time";
import type { LineupEntry, SectionType } from "@/lib/validation/match";
import { DEFAULT_MATCH_LENGTH } from "@/lib/domain/minutes";
import { positionFit } from "@/lib/domain/roles";
import type { SubPlan } from "@/lib/validation/match";
import { LineupPanel } from "./lineup-panel";
import { SetPiecesPanel } from "./set-pieces-panel";
import { SubPlanPanel, subPlanHealth } from "./sub-plan-panel";
import { MatchForm } from "./match-form";
import { SectionCard } from "./section-card";

function toEntries(rows: LineupRow[]): LineupEntry[] {
  const starters = rows.filter((r) => r.role === "starter").sort((a, b) => (a.slot ?? 99) - (b.slot ?? 99));
  const bench = rows.filter((r) => r.role === "bench");
  return [...starters, ...bench].map((r) => ({
    playerId: r.playerId,
    role: r.role,
    slot: r.slot ?? undefined,
    position: r.position ?? undefined,
    playerRole: r.playerRole ?? undefined,
    duty: r.duty ?? undefined,
    instruction: r.instruction ?? undefined,
  }));
}

export function PlanEditor({
  view,
  team,
  players,
  tactics,
}: {
  view: PlanView;
  team: { id: string; name: string; primaryColor: string };
  players: Player[];
  tactics: TacticSummary[];
}) {
  const { match, plan, sections } = view;
  const router = useRouter();
  const [lineup, setLineup] = useState(() => toEntries(view.lineup));
  const [subPlan, setSubPlan] = useState<SubPlan>(() => plan.subPlan ?? { matchLength: DEFAULT_MATCH_LENGTH[match.format], subs: [] });
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [picking, setPicking] = useState(false);
  const [pending, startTransition] = useTransition();

  const byId = new Map(players.map((p) => [p.id, p]));
  const subHealth = subPlanHealth(lineup, subPlan);
  const readiness = planReadiness({
    format: match.format,
    starters: lineup.filter((e) => e.role === "starter").map((e) => ({ archived: Boolean(byId.get(e.playerId)?.archivedAt) })),
    sections: sections.map((s) => ({
      title: s.title,
      type: s.type,
      included: s.includeInBriefing,
      hasTactic: Boolean(s.tactic),
      tacticFormat: s.tactic?.format ?? null,
    })),
    objective: plan.objective,
    outOfPosition: plan.formationId
      ? lineup.filter((e) => e.role === "starter" && positionFit(byId.get(e.playerId)?.preferredPositions ?? [], e.position) === "out").length
      : 0,
    subProblems: subHealth.problemCount,
    shortMinutes: subPlan.subs.length ? subHealth.short.length : 0,
  });
  const blocking = readiness.items.filter((i) => i.level === "blocking");

  const add = (type: SectionType, tacticId?: string) =>
    startTransition(async () => {
      const res = await addSection(plan.id, type, tacticId);
      if (res.status === "error") toast.error(res.message);
      setPicking(false);
      router.refresh();
    });

  const { date, time } = toZonedParts(match.kickoffAt, match.kickoffTz);

  return (
    // Grid children get min-w-0 so long names truncate instead of widening the page.
    <div className="grid gap-6 [&>*]:min-w-0">
      <header>
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <Link href={`/app/teams/${team.id}`} className="hover:underline">
            {team.name}
          </Link>
          <span aria-hidden> / </span>
          <Link href={`/app/teams/${team.id}/matches`} className="hover:underline">
            Matches
          </Link>
        </nav>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">vs {match.opponentName}</h1>
            <p className="text-muted-foreground">
              {match.kickoffLabel} · {formatLabel(match.format)}
            </p>
            {match.venue && (
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="size-3.5" aria-hidden /> {match.venue}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil aria-hidden /> Edit fixture
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDeleting(true)}>
              <Trash2 aria-hidden /> Delete
            </Button>
          </div>
        </div>
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">Draft · private to you</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[19rem_minmax(0,1fr)_17rem]">
        <div className="min-w-0">
          <LineupPanel planId={plan.id} format={match.format} players={players} initial={lineup} initialFormationId={plan.formationId} onChange={setLineup} />
        </div>

        <div className="grid min-w-0 content-start gap-4">
          <Objective planId={plan.id} initial={plan.objective ?? ""} />
          <SetPiecesPanel planId={plan.id} initial={plan.setPieces} lineup={lineup} players={players} />
          <SubPlanPanel planId={plan.id} format={match.format} initial={plan.subPlan} lineup={lineup} players={players} onChange={setSubPlan} />
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Briefing sections</h2>
            <span className="text-sm text-muted-foreground">Shown to players in this order</span>
          </div>
          {sections.length === 0 ? (
            <EmptyState
              title="No sections yet"
              description="Add a tactic board, coaching notes or final reminders. Each becomes a slide."
            />
          ) : (
            <div className="grid gap-3">
              {sections.map((s, i) => (
                <SectionCard key={s.id} section={s} index={i} count={sections.length} format={match.format} teamColor={team.primaryColor} />
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2" role="group" aria-label="Add a section">
            <Button variant="outline" disabled={pending} onClick={() => setPicking(true)}>
              <LayoutTemplate aria-hidden /> Add tactic board
            </Button>
            <Button variant="outline" disabled={pending} onClick={() => add("notes")}>
              <FileText aria-hidden /> Add notes
            </Button>
            <Button variant="outline" disabled={pending} onClick={() => add("reminders")}>
              <ListChecks aria-hidden /> Add final reminders
            </Button>
          </div>
        </div>

        <aside aria-labelledby="ready-heading" className="grid min-w-0 content-start gap-4">
          <section className="rounded-2xl border bg-card p-4">
            <h2 id="ready-heading" className="mb-3 font-semibold">
              Ready to publish?
            </h2>
            <ul className="grid gap-2" aria-label="Publishing checklist">
              {readiness.items.map((item) => (
                <li key={item.id} className="flex gap-2 text-sm" data-level={item.level}>
                  {item.level === "ok" ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-label="Done" />
                  ) : item.level === "blocking" ? (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="Required" />
                  ) : (
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-label="Check" />
                  )}
                  <span>{item.message}</span>
                </li>
              ))}
            </ul>
            <Link href={`/app/plans/${plan.id}/publish`} className={buttonVariants({ className: "mt-4 w-full" })} aria-describedby="publish-help">
              Preview &amp; publish
            </Link>
            <p id="publish-help" className="mt-2 text-xs text-muted-foreground">
              {blocking.length ? "You can preview now. Fix the required items above to publish. Your draft is saved either way." : "Ready to publish."}
            </p>
          </section>
          <section className="flex gap-2 rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
            <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden />
            <p>Plans are private. Players only ever see sections you include, never private notes or your full squad list.</p>
          </section>
        </aside>
      </div>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit fixture</DialogTitle>
          </DialogHeader>
          <MatchForm
            action={updateMatch.bind(null, match.id)}
            defaults={{ opponentName: match.opponentName, date, time, venue: match.venue, timeZone: match.kickoffTz }}
            submitLabel="Save fixture"
            pendingLabel="Saving…"
            onSuccess={() => {
              setEditing(false);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete the fixture vs {match.opponentName}?</DialogTitle>
            <DialogDescription>
              This permanently deletes the fixture, its lineup and all {sections.length} briefing section{sections.length === 1 ? "" : "s"}. Tactics in your library
              aren&apos;t affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await deleteMatch(match.id);
                  if (res?.status === "error") toast.error(res.message ?? "Couldn't delete.");
                })
              }
            >
              Delete fixture
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={picking} onOpenChange={setPicking}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Attach a tactic</DialogTitle>
            <DialogDescription>The board is copied into the briefing when you publish, so later edits won&apos;t change what players already have.</DialogDescription>
          </DialogHeader>
          {tactics.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tactics yet.{" "}
              <Link className="text-primary underline" href={`/app/teams/${team.id}/tactics`}>
                Create one in the library
              </Link>
              .
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Tactics to attach">
              {tactics.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => add("board", t.id)}
                    className="flex w-full flex-col gap-1.5 rounded-xl border p-2 text-left text-sm transition hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    {t.board && <BoardSvg board={t.board} teamColor={team.primaryColor} showLabels={false} decorative className="rounded-md" />}
                    <span className="truncate font-medium">{t.name}</span>
                    <span className="text-xs text-muted-foreground">{formatLabel(t.format)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Objective({ planId, initial }: { planId: string; initial: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  return (
    <section className="rounded-2xl border bg-card p-4">
      <div className="mb-1.5 flex items-baseline justify-between">
        <Label htmlFor="objective">Match objective</Label>
        <span className="text-xs text-muted-foreground" aria-live="polite" data-testid="objective-status">
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : `${value.length}/280`}
        </span>
      </div>
      <input
        id="objective"
        maxLength={280}
        value={value}
        placeholder="The one big idea, e.g. Win the second balls in midfield"
        onChange={(e) => setValue(e.target.value)}
        onBlur={async () => {
          if (value.trim() === saved.trim()) return;
          setStatus("saving");
          const res = await updateObjective(planId, value);
          if (res.status === "saved") {
            setSaved(value);
            setStatus("saved");
            router.refresh();
          } else {
            setStatus("idle");
            toast.error(res.message);
          }
        }}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
    </section>
  );
}
