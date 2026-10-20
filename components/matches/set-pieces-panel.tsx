"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveSetPieces } from "@/app/(app)/app/matches/actions";
import type { Player } from "@/lib/db/teams";
import { SET_PIECE_JOBS, SET_PIECE_LABELS, type LineupEntry, type SetPieces } from "@/lib/validation/match";
import { useSerialSave } from "./use-serial-save";

const SELECT = "h-8 min-w-0 rounded-lg border border-input bg-transparent px-2 text-sm";

/** Enhancement 4: who takes what, and who marks whom, like the set-piece screen in FM / EA FC. */
export function SetPiecesPanel({ planId, initial, lineup, players }: { planId: string; initial: SetPieces; lineup: LineupEntry[]; players: Player[] }) {
  const [sp, setSp] = useState<SetPieces>(initial);
  const { state, queue } = useSerialSave((v: SetPieces) => saveSetPieces(planId, v));
  const byId = new Map(players.map((p) => [p.id, p]));
  const starters = lineup.filter((e) => e.role === "starter");
  const isStarter = (id?: string) => Boolean(id && starters.some((s) => s.playerId === id));

  // Jobs held by someone who is no longer starting are dropped, here and in what we save.
  const effective: SetPieces = {
    ...Object.fromEntries(SET_PIECE_JOBS.flatMap((j) => (isStarter(sp[j]) ? [[j, sp[j]]] : []))),
    marking: sp.marking.filter((m) => isStarter(m.playerId)),
  };
  const commit = (next: SetPieces) => {
    setSp(next);
    queue({ ...next, marking: next.marking.filter((m) => isStarter(m.playerId) && m.target.trim()) });
  };
  const [draftMark, setDraftMark] = useState<{ playerId: string; target: string }>({ playerId: "", target: "" });

  const options = starters.map((e) => (
    <option key={e.playerId} value={e.playerId}>
      {byId.get(e.playerId)?.name ?? "Unknown player"}
    </option>
  ));

  return (
    <section aria-labelledby="sp-heading" className="rounded-2xl border bg-card p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 id="sp-heading" className="font-semibold">
          Set pieces
        </h2>
        <p className="text-sm text-muted-foreground" aria-live="polite" data-testid="setpieces-status">
          {state.status === "saving" ? "Saving…" : state.status === "saved" ? "Saved" : ""}
        </p>
      </div>
      {state.status === "error" && (
        <p role="alert" className="mb-2 text-sm text-destructive">
          {state.message}
        </p>
      )}
      {starters.length === 0 ? (
        <p className="text-sm text-muted-foreground">Pick your starters first, then choose who takes each set piece.</p>
      ) : (
        <>
          <div className="grid gap-2">
            {SET_PIECE_JOBS.map((j) => (
              <div key={j} className="grid grid-cols-[7rem_1fr] items-center gap-2">
                <label htmlFor={`sp-${j}`} className="text-sm text-muted-foreground">
                  {SET_PIECE_LABELS[j]}
                </label>
                <select id={`sp-${j}`} value={effective[j] ?? ""} onChange={(e) => commit({ ...effective, [j]: e.target.value || undefined })} className={SELECT}>
                  <option value="">Not set</option>
                  {options}
                </select>
              </div>
            ))}
          </div>

          <h3 className="mt-4 mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Marking at set pieces</h3>
          {effective.marking.length > 0 && (
            <ul className="mb-2 grid gap-1" aria-label="Marking jobs">
              {effective.marking.map((m, i) => (
                <li key={`${m.playerId}-${i}`} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{byId.get(m.playerId)?.name}</span> → {m.target}
                  </span>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Remove marking job for ${byId.get(m.playerId)?.name}`}
                    onClick={() => commit({ ...effective, marking: effective.marking.filter((_, k) => k !== i) })}
                  >
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!draftMark.playerId || !draftMark.target.trim()) return;
              commit({ ...effective, marking: [...effective.marking, { playerId: draftMark.playerId, target: draftMark.target.trim().slice(0, 40) }] });
              setDraftMark({ playerId: "", target: "" });
            }}
          >
            <label htmlFor="mark-player" className="sr-only">
              Player marking
            </label>
            <select id="mark-player" value={draftMark.playerId} onChange={(e) => setDraftMark({ ...draftMark, playerId: e.target.value })} className={`${SELECT} flex-1`}>
              <option value="">Player…</option>
              {options}
            </select>
            <label htmlFor="mark-target" className="sr-only">
              Who or where they mark
            </label>
            <input
              id="mark-target"
              value={draftMark.target}
              maxLength={40}
              placeholder="Marks… e.g. their #9, near post"
              onChange={(e) => setDraftMark({ ...draftMark, target: e.target.value })}
              className="h-8 min-w-0 flex-[2] rounded-lg border border-input bg-transparent px-2 text-sm"
            />
            <Button type="submit" size="sm" variant="outline" disabled={effective.marking.length >= 11 || !draftMark.playerId || !draftMark.target.trim()}>
              <Plus aria-hidden /> Add
            </Button>
          </form>
        </>
      )}
    </section>
  );
}
