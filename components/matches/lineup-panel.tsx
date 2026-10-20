"use client";

import { useRef, useState } from "react";
import { ArrowDownToLine, ArrowUpToLine, RefreshCw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { saveLineup, updateFormation } from "@/app/(app)/app/matches/actions";
import { BoardSvg } from "@/components/board/board-svg";
import type { Player } from "@/lib/db/teams";
import type { MatchFormat } from "@/lib/domain/format";
import { formationsFor } from "@/lib/domain/formations";
import { shortName } from "@/lib/domain/lineup-board";
import { assignSlot, fitRole, toBench, withFormation } from "@/lib/domain/lineup-slots";
import { DUTY_LABELS, positionFit, roleByKey, rolesFor, slotGroup, type Duty, type Fit } from "@/lib/domain/roles";
import { BOARD_SCHEMA_VERSION } from "@/lib/validation/board";
import type { LineupEntry } from "@/lib/validation/match";
import { cn } from "@/lib/utils";

type SaveState = { status: "idle" | "saving" | "saved" } | { status: "error"; message: string };

const FIT: Record<Fit, { label: string; ring: string; text: string }> = {
  natural: { label: "natural position", ring: "ring-emerald-400", text: "text-emerald-700" },
  adjacent: { label: "can cover", ring: "ring-amber-400", text: "text-amber-700" },
  out: { label: "out of position", ring: "ring-red-500", text: "text-red-700" },
  unknown: { label: "no preferred position", ring: "ring-white/70", text: "text-muted-foreground" },
};

/**
 * MATCH-02 lineup picker, with an optional formation (enhancement 2) that lays starters out on
 * a pitch, FM/EA FC style, and a role, duty and instruction per starter (enhancement 1).
 * Every change saves the whole lineup atomically; requests are serialised so the server always
 * ends up with the latest picks.
 */
export function LineupPanel({
  planId,
  format,
  players,
  initial,
  initialFormationId,
  onChange,
}: {
  planId: string;
  format: MatchFormat;
  players: Player[];
  initial: LineupEntry[];
  initialFormationId: string | null;
  onChange: (entries: LineupEntry[]) => void;
}) {
  const [entries, setEntries] = useState(initial);
  const [formationId, setFormationId] = useState(initialFormationId ?? "");
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const formations = formationsFor(format);
  const formation = formations.find((f) => f.id === formationId) ?? null;
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
  const preferred = (id: string) => byId.get(id)?.preferredPositions ?? [];
  const starters = entries.filter((e) => e.role === "starter").sort((a, b) => (formation ? (a.slot ?? 99) - (b.slot ?? 99) : 0));
  const bench = entries.filter((e) => e.role === "bench");
  const picked = new Set(entries.map((e) => e.playerId));
  const available = players.filter((p) => !p.archivedAt && !picked.has(p.id));
  const full = starters.length >= format;

  const setRole = (playerId: string, role: "starter" | "bench") => {
    const rest = entries.filter((e) => e.playerId !== playerId);
    const prev = entries.find((e) => e.playerId === playerId);
    if (role === "bench") return update([...rest, toBench(prev ?? { playerId, role })]);
    const next = [...rest, fitRole({ playerId, role, position: prev?.position ?? defaultPosition(byId.get(playerId)) })];
    update(withFormation(next, formation, preferred));
  };
  const remove = (playerId: string) => update(entries.filter((e) => e.playerId !== playerId));
  const patch = (playerId: string, p: Partial<LineupEntry>) => update(entries.map((e) => (e.playerId === playerId ? { ...e, ...p } : e)));
  const setPosition = (playerId: string, position: string) => {
    const e = entries.find((x) => x.playerId === playerId);
    if (e) update(entries.map((x) => (x === e ? fitRole({ ...e, position: position.trim().slice(0, 12) }) : x)));
  };
  const chooseFormation = async (id: string) => {
    setFormationId(id);
    setActiveSlot(null);
    const f = formations.find((x) => x.id === id) ?? null;
    update(withFormation(entries, f, preferred));
    const res = await updateFormation(planId, id || null).catch(() => ({ status: "error" as const, message: "Couldn't reach the server." }));
    if (res.status === "error") setSave({ status: "error", message: res.message });
  };
  const occupant = (slot: number) => entries.find((e) => e.role === "starter" && e.slot === slot);

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

      <div className="mb-3 flex items-center gap-2">
        <label htmlFor="formation" className="text-sm font-medium">
          Formation
        </label>
        <select
          id="formation"
          value={formationId}
          onChange={(e) => void chooseFormation(e.target.value)}
          className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">None (list only)</option>
          {formations.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      {formation && (
        <div className="mb-3">
          <div className="relative mx-auto w-full max-w-[15rem] overflow-hidden rounded-lg" style={{ aspectRatio: "74 / 111" }} role="group" aria-label={`${formation.name} pitch`}>
            <BoardSvg board={{ schemaVersion: BOARD_SCHEMA_VERSION, format, orientation: "vertical", objects: [] }} decorative className="absolute inset-0 h-full w-full" />
            {formation.slots.map(([label, x, y], i) => {
              const slot = i + 1;
              const e = occupant(slot);
              const p = e ? byId.get(e.playerId) : undefined;
              const fit = e ? positionFit(preferred(e.playerId), label) : "unknown";
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setActiveSlot(activeSlot === slot ? null : slot)}
                  aria-pressed={activeSlot === slot}
                  aria-label={`${label}: ${p ? `${p.name}, ${FIT[fit].label}` : "empty"}. Choose player`}
                  data-fit={e ? fit : undefined}
                  className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 rounded-md focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                  style={{ left: `${((x / 100) * 68 + 3) / 0.74}%`, top: `${((y / 100) * 105 + 3) / 1.11}%` }}
                >
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full text-xs font-bold ring-2",
                      p ? "bg-zinc-900 text-white" : "border border-dashed border-white/80 bg-white/10 text-white",
                      p ? FIT[fit].ring : "ring-transparent",
                      activeSlot === slot && "outline-2 outline-offset-2 outline-yellow-300",
                    )}
                  >
                    {p ? (p.shirtNumber ?? label) : "+"}
                  </span>
                  <span className="max-w-[4.5rem] truncate rounded bg-black/45 px-1 text-[10px] leading-tight font-semibold text-white">{p ? shortName(p.name) : label}</span>
                </button>
              );
            })}
          </div>
          {activeSlot && (
            <div className="mt-2 flex items-center gap-2">
              <label htmlFor="slot-player" className="shrink-0 text-sm font-medium">
                {formation.slots[activeSlot - 1][0]}
              </label>
              <select
                id="slot-player"
                value={occupant(activeSlot)?.playerId ?? ""}
                onChange={(ev) => {
                  update(assignSlot(entries, formation, activeSlot, ev.target.value || null));
                  setActiveSlot(null);
                }}
                className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2 text-sm"
              >
                <option value="">Empty</option>
                {[...starters, ...bench].map((e) => {
                  const p = byId.get(e.playerId);
                  return (
                    <option key={e.playerId} value={e.playerId}>
                      {p?.name ?? "Unknown player"} ({e.role === "starter" ? (e.position ?? "starter") : "bench"}, {FIT[positionFit(preferred(e.playerId), formation.slots[activeSlot - 1][0])].label})
                    </option>
                  );
                })}
                {available.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({FIT[positionFit(p.preferredPositions, formation.slots[activeSlot - 1][0])].label})
                  </option>
                ))}
              </select>
            </div>
          )}
          <p className="mt-1.5 flex flex-wrap justify-center gap-x-3 text-[11px] text-muted-foreground">
            <span><span aria-hidden className="mr-1 inline-block size-2 rounded-full bg-emerald-400" />Natural</span>
            <span><span aria-hidden className="mr-1 inline-block size-2 rounded-full bg-amber-400" />Can cover</span>
            <span><span aria-hidden className="mr-1 inline-block size-2 rounded-full bg-red-500" />Out of position</span>
          </p>
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
            const role = roleByKey(e.playerRole);
            const fit = positionFit(preferred(e.playerId), e.position);
            return (
              <li key={e.playerId} className="grid gap-1 rounded-lg bg-muted/50 px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <Num n={p?.shirtNumber} />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {p?.name ?? "Unknown player"}
                    {p?.archivedAt && (
                      <Badge variant="outline" className="ml-1">
                        archived
                      </Badge>
                    )}
                  </span>
                  {formation ? (
                    <span className={cn("w-12 shrink-0 text-center text-xs font-semibold", FIT[fit].text)} title={FIT[fit].label}>
                      {e.position}
                      <span className="sr-only">, {FIT[fit].label}</span>
                    </span>
                  ) : (
                    <>
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
                    </>
                  )}
                  <IconBtn label={`Move ${p?.name} to bench`} onClick={() => setRole(e.playerId, "bench")}>
                    <ArrowDownToLine />
                  </IconBtn>
                  <IconBtn label={`Remove ${p?.name} from lineup`} onClick={() => remove(e.playerId)}>
                    <X />
                  </IconBtn>
                </div>
                <div className="flex gap-1 pl-8">
                  <label className="sr-only" htmlFor={`role-${e.playerId}`}>
                    Role for {p?.name}
                  </label>
                  <select
                    id={`role-${e.playerId}`}
                    value={e.playerRole ?? ""}
                    title={role?.blurb}
                    onChange={(ev) => {
                      const r = roleByKey(ev.target.value);
                      patch(e.playerId, { playerRole: r?.key, duty: r ? (r.duties.includes(e.duty as Duty) ? e.duty : r.duties[0]) : undefined });
                    }}
                    className="h-7 min-w-0 flex-1 rounded-md border bg-background px-1 text-xs"
                  >
                    <option value="">No role</option>
                    {rolesFor(slotGroup(e.position)).map((r) => (
                      <option key={r.key} value={r.key}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <label className="sr-only" htmlFor={`duty-${e.playerId}`}>
                    Duty for {p?.name}
                  </label>
                  <select
                    id={`duty-${e.playerId}`}
                    value={e.duty ?? ""}
                    disabled={!role}
                    onChange={(ev) => patch(e.playerId, { duty: ev.target.value || undefined })}
                    className="h-7 w-[5.5rem] rounded-md border bg-background px-1 text-xs disabled:opacity-50"
                  >
                    {!role && <option value="">Duty</option>}
                    {role?.duties.map((d) => (
                      <option key={d} value={d}>
                        {DUTY_LABELS[d]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="pl-8">
                  <label className="sr-only" htmlFor={`ins-${e.playerId}`}>
                    Instruction for {p?.name}
                  </label>
                  <input
                    id={`ins-${e.playerId}`}
                    key={e.instruction ?? ""}
                    defaultValue={e.instruction ?? ""}
                    maxLength={140}
                    placeholder="Personal instruction (optional)"
                    onBlur={(ev) => ev.target.value.trim() !== (e.instruction ?? "") && patch(e.playerId, { instruction: ev.target.value.trim() || undefined })}
                    onKeyDown={(ev) => ev.key === "Enter" && ev.currentTarget.blur()}
                    className="h-7 w-full rounded-md border bg-background px-1.5 text-xs"
                  />
                </div>
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
