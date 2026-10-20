"use client";

import { useState } from "react";
import { UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { SlideSpec } from "@/lib/domain/slides";
import { playerCard, type Snapshot } from "@/lib/domain/snapshot";
import { SET_PIECE_LABELS } from "@/lib/validation/match";

/**
 * Enhancement 3, "Find me": a player picks their name and gets just their part of the plan,
 * like an FM player-instructions card. Everything comes from the snapshot already on screen;
 * nothing is sent to the server, and players are identified only by per-briefing keys.
 */
export function FindMe({ snapshot, slides, onHighlight }: { snapshot: Snapshot; slides: SlideSpec[]; onHighlight: (key: string | undefined) => void }) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const people = [...snapshot.lineup.starters, ...snapshot.lineup.bench].filter((p) => p.key);
  const card = key ? playerCard(snapshot, key) : null;
  const slideNo = (id: string) => slides.findIndex((s) => s.id === id) + 1;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-zinc-300 hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none"
      >
        <UserRound className="size-4" aria-hidden /> Find me
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Find me</DialogTitle>
            <DialogDescription>Pick your name to see your job in this plan.</DialogDescription>
          </DialogHeader>
          <label htmlFor="find-me" className="text-sm font-medium">
            Who are you?
          </label>
          <select
            id="find-me"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">Choose your name…</option>
            {people.map((p) => (
              <option key={p.key} value={p.key}>
                {p.number != null ? `${p.number} · ` : ""}
                {p.name}
              </option>
            ))}
          </select>

          {card && (
            <section aria-label={`${card.name}'s briefing`} className="grid gap-3 rounded-xl border bg-muted/40 p-4 text-sm" data-testid="player-card">
              <div>
                <p className="text-base font-semibold">
                  {card.number != null && <span className="mr-1 text-muted-foreground tabular-nums">{card.number}</span>}
                  {card.name}
                </p>
                <p className="text-muted-foreground">{card.starting ? `Starting${card.position ? ` · ${card.position}` : ""}` : "On the bench"}</p>
              </div>
              <dl className="grid gap-2">
                {card.role && <Row label="Role">{card.role}</Row>}
                {card.instruction && <Row label="Your instruction">{card.instruction}</Row>}
                {card.jobs.length > 0 && <Row label="Set pieces">{card.jobs.map((j) => SET_PIECE_LABELS[j]).join(", ")}</Row>}
                {card.marking.length > 0 && <Row label="Marking">{card.marking.join(", ")}</Row>}
                {(card.subsIn.length > 0 || card.subsOut.length > 0) && (
                  <Row label="Subs">
                    {[...card.subsIn.map((m) => ({ m, t: `On at ${m}′` })), ...card.subsOut.map((m) => ({ m, t: `Off at ${m}′` }))]
                      .sort((a, b) => a.m - b.m)
                      .map((x) => x.t)
                      .join(" · ")}
                  </Row>
                )}
                {card.minutes != null && snapshot.subPlan && (
                  <Row label="Planned minutes">
                    {card.minutes} of {snapshot.subPlan.matchLength}
                  </Row>
                )}
                {card.boards.length > 0 && (
                  <Row label="You're on">
                    {card.boards.map((b) => `${snapshot.sections.find((s) => s.key === b)?.title} (slide ${slideNo(b)})`).join(", ")}
                  </Row>
                )}
              </dl>
              <Button
                onClick={() => {
                  onHighlight(card.key);
                  setOpen(false);
                }}
              >
                Highlight me in the briefing
              </Button>
            </section>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}
