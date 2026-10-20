"use client";

import { useState } from "react";
import { AlertTriangle, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveSubPlan } from "@/app/(app)/app/matches/actions";
import type { Player } from "@/lib/db/teams";
import type { MatchFormat } from "@/lib/domain/format";
import { computeMinutes, DEFAULT_MATCH_LENGTH, FAIR_SHARE } from "@/lib/domain/minutes";
import type { LineupEntry, SubPlan } from "@/lib/validation/match";
import { cn } from "@/lib/utils";
import { useSerialSave } from "./use-serial-save";

type Row = { id: number; minute: string; outId: string; inId: string };
const SELECT = "h-8 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2 text-sm";

/** Complete, in-range rows only; half-filled rows stay on screen until they're finished. */
export function completeSubs(rows: Row[], length: number): SubPlan["subs"] {
  return rows.flatMap((r) => {
    const minute = Number(r.minute);
    return Number.isInteger(minute) && minute >= 1 && minute < length && r.outId && r.inId ? [{ minute, outId: r.outId, inId: r.inId }] : [];
  });
}

export function subPlanHealth(lineup: LineupEntry[], plan: SubPlan) {
  const starters = lineup.filter((e) => e.role === "starter").map((e) => e.playerId);
  const bench = lineup.filter((e) => e.role === "bench").map((e) => e.playerId);
  const r = computeMinutes(starters, bench, plan.subs.map((s) => ({ minute: s.minute, outKey: s.outId, inKey: s.inId })), plan.matchLength);
  return { ...r, problemCount: r.problems.filter(Boolean).length };
}

/**
 * Enhancement 5: a substitution plan with planned minutes per player, so a grassroots captain
 * can check everyone gets a fair game before kickoff (FM's "match plan", without the stats).
 */
export function SubPlanPanel({
  planId,
  format,
  initial,
  lineup,
  players,
  onChange,
}: {
  planId: string;
  format: MatchFormat;
  initial: SubPlan | null;
  lineup: LineupEntry[];
  players: Player[];
  onChange: (plan: SubPlan) => void;
}) {
  const [length, setLength] = useState(initial?.matchLength ?? DEFAULT_MATCH_LENGTH[format]);
  const [rows, setRows] = useState<Row[]>(() => (initial?.subs ?? []).map((s, i) => ({ id: i, minute: String(s.minute), outId: s.outId, inId: s.inId })));
  const [nextId, setNextId] = useState(rows.length);
  const { state, queue } = useSerialSave((v: SubPlan) => saveSubPlan(planId, v));
  const byId = new Map(players.map((p) => [p.id, p]));
  const name = (id: string) => byId.get(id)?.name ?? "Unknown player";
  const squad = lineup.map((e) => e.playerId);

  const commit = (nextRows: Row[], nextLength = length) => {
    setRows(nextRows);
    setLength(nextLength);
    const plan = { matchLength: nextLength, subs: completeSubs(nextRows, nextLength).filter((s) => squad.includes(s.outId) && squad.includes(s.inId)) };
    onChange(plan);
    queue(plan);
  };
  const setRow = (id: number, p: Partial<Row>) => setRows(rows.map((r) => (r.id === id ? { ...r, ...p } : r)));

  const plan: SubPlan = { matchLength: length, subs: completeSubs(rows, length) };
  const health = subPlanHealth(lineup, plan);
  // Map each complete row to its problem, by position in the complete list.
  let k = -1;
  const problemOf = (r: Row) => (completeSubs([r], length).length ? health.problems[++k] : null);

  return (
    <section aria-labelledby="subs-heading" className="rounded-2xl border bg-card p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 id="subs-heading" className="font-semibold">
          Sub plan &amp; minutes
        </h2>
        <p className="text-sm text-muted-foreground" aria-live="polite" data-testid="subs-status">
          {state.status === "saving" ? "Saving…" : state.status === "saved" ? "Saved" : ""}
        </p>
      </div>
      {state.status === "error" && (
        <p role="alert" className="mb-2 text-sm text-destructive">
          {state.message}
        </p>
      )}
      {squad.length === 0 ? (
        <p className="text-sm text-muted-foreground">Pick a lineup and bench first, then plan your substitutions.</p>
      ) : (
        <>
          <div className="mb-3 flex items-center gap-2">
            <label htmlFor="match-length" className="text-sm text-muted-foreground">
              Match length (minutes)
            </label>
            <input
              id="match-length"
              type="number"
              min={10}
              max={120}
              key={length}
              defaultValue={length}
              onBlur={(e) => {
                const v = Math.round(Number(e.target.value));
                if (v >= 10 && v <= 120 && v !== length) commit(rows, v);
                else e.target.value = String(length);
              }}
              className="h-8 w-20 rounded-lg border border-input bg-transparent px-2 text-sm tabular-nums"
            />
          </div>

          {rows.length > 0 && (
            <ol className="mb-2 grid gap-2" aria-label="Planned substitutions">
              {rows.map((r, i) => {
                const problem = problemOf(r);
                return (
                  <li key={r.id} className="grid gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <label htmlFor={`sub-min-${r.id}`} className="sr-only">
                        Minute of sub {i + 1}
                      </label>
                      <input
                        id={`sub-min-${r.id}`}
                        type="number"
                        min={1}
                        max={length - 1}
                        value={r.minute}
                        placeholder="Min"
                        onChange={(e) => setRow(r.id, { minute: e.target.value })}
                        onBlur={() => commit(rows)}
                        className="h-8 w-16 rounded-lg border border-input bg-transparent px-2 text-sm tabular-nums"
                      />
                      <label htmlFor={`sub-off-${r.id}`} className="sr-only">
                        Player off in sub {i + 1}
                      </label>
                      <select id={`sub-off-${r.id}`} value={r.outId} onChange={(e) => commit(rows.map((x) => (x.id === r.id ? { ...x, outId: e.target.value } : x)))} className={SELECT}>
                        <option value="">Off…</option>
                        {squad.map((id) => (
                          <option key={id} value={id}>
                            {name(id)}
                          </option>
                        ))}
                      </select>
                      <label htmlFor={`sub-on-${r.id}`} className="sr-only">
                        Player on in sub {i + 1}
                      </label>
                      <select id={`sub-on-${r.id}`} value={r.inId} onChange={(e) => commit(rows.map((x) => (x.id === r.id ? { ...x, inId: e.target.value } : x)))} className={SELECT}>
                        <option value="">On…</option>
                        {squad.map((id) => (
                          <option key={id} value={id}>
                            {name(id)}
                          </option>
                        ))}
                      </select>
                      <Button size="icon-xs" variant="ghost" aria-label={`Remove sub ${i + 1}`} onClick={() => commit(rows.filter((x) => x.id !== r.id))}>
                        <X />
                      </Button>
                    </div>
                    {problem && (
                      <p className="flex items-center gap-1 text-xs text-amber-700">
                        <AlertTriangle className="size-3.5" aria-hidden /> {problem}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={rows.length >= 30}
            onClick={() => {
              setRows([...rows, { id: nextId, minute: String(Math.round(length / 2)), outId: "", inId: "" }]);
              setNextId(nextId + 1);
            }}
          >
            <Plus aria-hidden /> Add sub
          </Button>

          <h3 className="mt-4 mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Planned minutes</h3>
          <ul className="grid gap-1.5" aria-label="Planned minutes">
            {squad.map((id) => {
              const m = health.minutes[id] ?? 0;
              const short = m < length * FAIR_SHARE;
              return (
                <li key={id} className="grid grid-cols-[minmax(0,8rem)_1fr_3rem] items-center gap-2 text-sm">
                  <span className="truncate">{name(id)}</span>
                  <span aria-hidden className="h-2 overflow-hidden rounded-full bg-muted">
                    <span className={cn("block h-full rounded-full", short ? "bg-amber-500" : "bg-primary")} style={{ width: `${(m / length) * 100}%` }} />
                  </span>
                  <span className={cn("text-right tabular-nums", short && "font-semibold text-amber-700")}>
                    {m}&prime;<span className="sr-only">{short ? ", under half the match" : ""}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          {health.short.length > 0 && (
            <p className="mt-2 text-xs text-amber-700">
              {health.short.length} player{health.short.length === 1 ? " gets" : "s get"} under half the match.
            </p>
          )}
        </>
      )}
    </section>
  );
}
