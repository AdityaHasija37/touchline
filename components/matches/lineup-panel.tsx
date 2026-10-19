"use client";

import { useRef, useState } from "react";
import { ArrowDownToLine, ArrowUpToLine, RefreshCw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { saveLineup } from "@/app/(app)/app/matches/actions";
import type { Player } from "@/lib/db/teams";
import type { MatchFormat } from "@/lib/domain/format";
import type { LineupEntry } from "@/lib/validation/match";

type SaveState = { status: "idle" | "saving" | "saved" } | { status: "error"; message: string };

/**
 * MATCH-02 lineup picker. Every change saves the whole lineup atomically; requests are
 * serialised so the server always ends up with the latest picks.
 */
export function LineupPanel({
  planId,
  format,
  players,
  initial,
  onChange,
}: {
  planId: string;
  format: MatchFormat;
  players: Player[];
  initial: LineupEntry[];
  onChange: (entries: LineupEntry[]) => void;
}) {
  const [entries, setEntries] = useState(initial);
  const [save, setSave] = useState<SaveState>({ status: "idle" });
  const latest = useRef<LineupEntry[] | null>(null);
  const running = useRef(false);

  const flush = async () => {
    if (running.current) return;
    running.current = true;
    try {
      while (latest.current) {
        const next = latest.current;
        latest.current = null;
        setSave({ status: "saving" });
        const res = await saveLineup(planId, next).catch(() => ({ status: "error" as const, message: "Couldn't reach the server. Your picks are still here." }));
        if (res.status === "error") {
          setSave({ status: "error", message: res.message });
          return;
        }
      }
      setSave({ status: "saved" });
    } finally {
      running.current = false;
    }
  };

  const update = (next: LineupEntry[]) => {
    setEntries(next);
    onChange(next);
    latest.current = next;
    void flush();
  };

  const byId = new Map(players.map((p) => [p.id, p]));
  const starters = entries.filter((e) => e.role === "starter");
  const bench = entries.filter((e) => e.role === "bench");
  const picked = new Set(entries.map((e) => e.playerId));
  const available = players.filter((p) => !p.archivedAt && !picked.has(p.id));
  const full = starters.length >= format;

  const setRole = (playerId: string, role: "starter" | "bench") => {
    const rest = entries.filter((e) => e.playerId !== playerId);
    const prev = entries.find((e) => e.playerId === playerId);
    update([...rest, { playerId, role, position: role === "starter" ? (prev?.position ?? defaultPosition(byId.get(playerId))) : undefined }]);
  };
  const remove = (playerId: string) => update(entries.filter((e) => e.playerId !== playerId));
  const setPosition = (playerId: string, position: string) =>
    update(entries.map((e) => (e.playerId === playerId ? { ...e, position: position.trim().slice(0, 12) } : e)));

  return (
    <section aria-labelledby="lineup-heading" className="rounded-2xl border bg-card p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 id="lineup-heading" className="font-semibold">
          Lineup
        </h2>
        <p className="text-sm text-muted-foreground" aria-live="polite" data-testid="lineup-status">
          {save.status === "saving" ? "Saving…" : save.status === "saved" ? "Saved" : save.status === "error" ? "" : ""}
        </p>
      </div>
      {save.status === "error" && (
        <div role="alert" className="mb-3 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <span className="flex-1">{save.message}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              latest.current = entries;
              void flush();
            }}
          >
            <RefreshCw aria-hidden /> Retry
          </Button>
        </div>
      )}

      <h3 className="mb-1 flex items-center justify-between text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        <span>Starters</span>
        <span data-testid="starter-count" className={full ? "text-primary" : undefined}>
          {starters.length}/{format}
        </span>
      </h3>
      {starters.length === 0 ? (
        <p className="mb-3 text-sm text-muted-foreground">Pick {format} starters from the squad below.</p>
      ) : (
        <ol aria-label="Starters" className="mb-3 grid gap-1">
          {starters.map((e) => {
            const p = byId.get(e.playerId);
            return (
              <li key={e.playerId} className="flex items-center gap-2 rounded-lg bg-muted/50 px-2 py-1">
                <Num n={p?.shirtNumber} />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {p?.name ?? "Unknown player"}
                  {p?.archivedAt && (
                    <Badge variant="outline" className="ml-1">
                      archived
                    </Badge>
                  )}
                </span>
                <label className="sr-only" htmlFor={`pos-${e.playerId}`}>
                  Position for {p?.name}
                </label>
                <input
                  id={`pos-${e.playerId}`}
                  key={e.position ?? ""}
                  defaultValue={e.position ?? ""}
                  maxLength={12}
                  placeholder="Pos"
                  onBlur={(ev) => ev.target.value.trim() !== (e.position ?? "") && setPosition(e.playerId, ev.target.value)}
                  onKeyDown={(ev) => ev.key === "Enter" && ev.currentTarget.blur()}
                  className="h-7 w-14 rounded-md border bg-background px-1.5 text-center text-xs uppercase"
                />
                <IconBtn label={`Move ${p?.name} to bench`} onClick={() => setRole(e.playerId, "bench")}>
                  <ArrowDownToLine />
                </IconBtn>
                <IconBtn label={`Remove ${p?.name} from lineup`} onClick={() => remove(e.playerId)}>
                  <X />
                </IconBtn>
              </li>
            );
          })}
        </ol>
      )}

      <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Bench ({bench.length})</h3>
      {bench.length === 0 ? (
        <p className="mb-3 text-sm text-muted-foreground">No substitutes yet.</p>
      ) : (
        <ul aria-label="Bench" className="mb-3 grid gap-1">
          {bench.map((e) => {
            const p = byId.get(e.playerId);
            return (
              <li key={e.playerId} className="flex items-center gap-2 rounded-lg px-2 py-1">
                <Num n={p?.shirtNumber} />
                <span className="min-w-0 flex-1 truncate text-sm">{p?.name ?? "Unknown player"}</span>
                <IconBtn label={`Start ${p?.name}`} disabled={full} onClick={() => setRole(e.playerId, "starter")}>
                  <ArrowUpToLine />
                </IconBtn>
                <IconBtn label={`Remove ${p?.name} from lineup`} onClick={() => remove(e.playerId)}>
                  <X />
                </IconBtn>
              </li>
            );
          })}
        </ul>
      )}

      <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Squad ({available.length} available)</h3>
      {players.length === 0 ? (
        <p className="text-sm text-muted-foreground">Add players to your squad first.</p>
      ) : available.length === 0 ? (
        <p className="text-sm text-muted-foreground">Everyone available is picked.</p>
      ) : (
        <ul aria-label="Available players" className="grid gap-1">
          {available.map((p) => (
            <li key={p.id} className="flex items-center gap-2 px-2 py-1">
              <Num n={p.shirtNumber} />
              <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
              <Button
                size="xs"
                variant="outline"
                disabled={full}
                title={full ? `All ${format} starters picked` : undefined}
                aria-label={`Start ${p.name}`}
                onClick={() => setRole(p.id, "starter")}
              >
                Start
              </Button>
              <Button size="xs" variant="ghost" aria-label={`Bench ${p.name}`} onClick={() => setRole(p.id, "bench")}>
                Bench
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function defaultPosition(p?: Player): string | undefined {
  return p?.preferredPositions[0];
}

function Num({ n }: { n?: number | null }) {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-background text-xs font-semibold tabular-nums ring-1 ring-border" aria-hidden>
      {n ?? "–"}
    </span>
  );
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <Button size="icon-xs" variant="ghost" aria-label={label} title={label} disabled={disabled} onClick={onClick}>
      {children}
    </Button>
  );
}
