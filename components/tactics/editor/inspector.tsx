"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { countMarkers } from "@/lib/domain/board-ops";
import type { Player } from "@/lib/db/teams";
import type { BoardObject, PlayerMarker } from "@/lib/validation/board";
import { cn } from "@/lib/utils";
import { useEditor } from "./context";

const selectCls =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const inputCls =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function describe(o: BoardObject): string {
  switch (o.kind) {
    case "player":
      return o.team === "home" ? `Player ${o.label || "(no label)"}` : `Opponent ${o.label || "(no label)"}`;
    case "ball":
      return "Ball";
    case "arrow":
      return `Arrow (${o.style})`;
    case "line":
      return "Line";
    case "zone":
      return `Zone${o.label ? ` ${o.label}` : ""}`;
    case "text":
      return `Text “${o.text.slice(0, 20)}”`;
  }
}

function position(o: BoardObject) {
  return o.kind === "arrow" || o.kind === "line" ? o.from : { x: o.x, y: o.y };
}

export function labelFor(p: Player): string {
  if (p.shirtNumber !== null) return String(p.shirtNumber);
  return p.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

/** Right-hand panel: selection properties plus a list of every object (keyboard alternative to the canvas). */
export function Inspector({ players }: { players: Player[] }) {
  const board = useEditor((s) => s.board);
  const selectedId = useEditor((s) => s.selectedId);
  const select = useEditor((s) => s.select);
  const dispatch = useEditor((s) => s.dispatch);
  const selected = board.objects.find((o) => o.id === selectedId) ?? null;
  const nameOf = (o: BoardObject) => (o.kind === "player" && o.playerId ? players.find((p) => p.id === o.playerId)?.name : undefined);

  return (
    <aside aria-label="Inspector" className="flex min-h-0 flex-col border-l">
      <section aria-labelledby="props-heading" className="border-b p-4">
        <h2 id="props-heading" className="mb-3 text-sm font-semibold">
          {selected ? describe(selected) : "Board"}
        </h2>
        {selected ? (
          <SelectionProps key={selected.id} o={selected} players={players} />
        ) : (
          <div className="grid gap-3 text-sm">
            <div className="grid gap-1.5">
              <Label htmlFor="orientation">Orientation</Label>
              <select
                id="orientation"
                className={selectCls}
                value={board.orientation}
                onChange={(e) => dispatch({ type: "orientation", orientation: e.target.value as "vertical" | "horizontal" })}
              >
                <option value="vertical">Vertical (attack up)</option>
                <option value="horizontal">Horizontal (attack right)</option>
              </select>
            </div>
            <p className="text-muted-foreground">
              Your players {countMarkers(board, "home")}/{board.format} · Opponents {countMarkers(board, "away")}/{board.format}
            </p>
          </div>
        )}
      </section>
      <section aria-labelledby="objects-heading" className="min-h-0 flex-1 overflow-y-auto p-2">
        <h2 id="objects-heading" className="px-2 py-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          On the pitch ({board.objects.length})
        </h2>
        {board.objects.length === 0 ? (
          <p className="px-2 py-1 text-sm text-muted-foreground">Nothing yet. Add players or the ball from the toolbar.</p>
        ) : (
          <ul aria-label="Board objects" className="grid gap-0.5">
            {board.objects.map((o) => {
              const p = position(o);
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => select(o.id)}
                    aria-pressed={o.id === selectedId}
                    data-testid={`object-${o.id}`}
                    data-x={p.x}
                    data-y={p.y}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                      o.id === selectedId && "bg-accent text-accent-foreground",
                    )}
                  >
                    <span className="truncate">
                      {describe(o)}
                      {nameOf(o) && <span className="text-muted-foreground"> · {nameOf(o)}</span>}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {p.x}, {p.y}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </aside>
  );
}

function SelectionProps({ o, players }: { o: BoardObject; players: Player[] }) {
  const dispatch = useEditor((s) => s.dispatch);
  const board = useEditor((s) => s.board);
  const pos = position(o);

  return (
    <div className="grid gap-3 text-sm">
      {o.kind === "player" && o.team === "home" && <SquadPicker marker={o} players={players} usedIds={board.objects.flatMap((x) => (x.kind === "player" && x.playerId && x.id !== o.id ? [x.playerId] : []))} />}
      {o.kind === "player" && <LabelField key={o.label} marker={o} />}
      <div className="grid grid-cols-2 gap-2">
        <CoordField key={`x${pos.x}`} label="Across (x)" value={pos.x} onCommit={(x) => dispatch({ type: "move", id: o.id, to: { x, y: pos.y } })} />
        <CoordField key={`y${pos.y}`} label="Along (y)" value={pos.y} onCommit={(y) => dispatch({ type: "move", id: o.id, to: { x: pos.x, y } })} />
      </div>
      <Button variant="destructive" size="sm" onClick={() => dispatch({ type: "remove", id: o.id })}>
        <Trash2 aria-hidden /> Remove from board
      </Button>
    </div>
  );
}

function SquadPicker({ marker, players, usedIds }: { marker: PlayerMarker; players: Player[]; usedIds: string[] }) {
  const dispatch = useEditor((s) => s.dispatch);
  const linked = players.find((p) => p.id === marker.playerId);
  const options = players.filter((p) => (!p.archivedAt && !usedIds.includes(p.id)) || p.id === marker.playerId);
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="squad-player">Squad player</Label>
      <select
        id="squad-player"
        className={selectCls}
        value={marker.playerId ?? ""}
        onChange={(e) => {
          const p = players.find((x) => x.id === e.target.value);
          dispatch({ type: "assign", id: marker.id, playerId: p?.id ?? null, label: p ? labelFor(p) : marker.label });
        }}
      >
        <option value="">Not linked</option>
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            {p.shirtNumber !== null ? `${p.shirtNumber} · ` : ""}
            {p.name}
            {p.archivedAt ? " (archived)" : ""}
          </option>
        ))}
      </select>
      {players.length === 0 && <p className="text-xs text-muted-foreground">Add players to your squad to link them here.</p>}
      {linked?.archivedAt && <p className="text-xs text-muted-foreground">This player is archived.</p>}
    </div>
  );
}

function LabelField({ marker }: { marker: PlayerMarker }) {
  const dispatch = useEditor((s) => s.dispatch);
  const [value, setValue] = useState(marker.label);
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="marker-label">Label on pitch</Label>
      <input
        id="marker-label"
        className={inputCls}
        maxLength={12}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => value !== marker.label && dispatch({ type: "relabel", id: marker.id, label: value })}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setValue(marker.label);
        }}
      />
    </div>
  );
}

function CoordField({ label, value, onCommit }: { label: string; value: number; onCommit: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  const id = `coord-${label.replace(/\W+/g, "-").toLowerCase()}`;
  const commit = () => {
    const n = Number(text);
    if (text.trim() === "" || Number.isNaN(n)) return setText(String(value));
    if (n !== value) onCommit(n);
  };
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <input
        id={id}
        className={inputCls}
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
      />
    </div>
  );
}
