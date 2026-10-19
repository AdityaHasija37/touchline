"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { countMarkers, ZONE_COLORS, type ArrowStyle } from "@/lib/domain/board-ops";
import { MAX_TEXT } from "@/lib/validation/board";
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
      return `Text “${o.text.length > 20 ? `${o.text.slice(0, 20).trimEnd()}…` : o.text}”`;
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
  const tool = useEditor((s) => s.tool);
  const pendingText = useEditor((s) => s.pendingText);
  const selected = board.objects.find((o) => o.id === selectedId) ?? null;
  const nameOf = (o: BoardObject) => (o.kind === "player" && o.playerId ? players.find((p) => p.id === o.playerId)?.name : undefined);

  return (
    <aside aria-label="Inspector" className="flex min-h-0 flex-col border-l">
      <section aria-labelledby="props-heading" className="border-b p-4">
        <h2 id="props-heading" className="mb-3 text-sm font-semibold">
          {pendingText ? "New text" : selected ? describe(selected) : TOOL_TITLES[tool]}
        </h2>
        {pendingText ? (
          <NewTextPanel key={`${pendingText.x},${pendingText.y}`} />
        ) : selected ? (
          <SelectionProps key={selected.id} o={selected} players={players} />
        ) : tool !== "select" ? (
          <ToolPanel />
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
          <p className="px-2 py-1 text-sm text-muted-foreground">Nothing yet. Add players, the ball, arrows or zones from the toolbar.</p>
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
                    data-geom={JSON.stringify(o)}
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

const TOOL_TITLES: Record<string, string> = {
  select: "Board",
  arrow: "Arrow tool",
  line: "Line tool",
  zone: "Zone tool",
  text: "Text tool",
  erase: "Erase tool",
};

const STYLE_LABELS: Record<ArrowStyle, string> = { run: "Run (dashed)", pass: "Pass (solid)", dribble: "Dribble (dotted)" };

function ToolPanel() {
  const tool = useEditor((s) => s.tool);
  const arrowStyle = useEditor((s) => s.arrowStyle);
  const setArrowStyle = useEditor((s) => s.setArrowStyle);
  const hints: Record<string, string> = {
    arrow: "Drag on the pitch from start to end.",
    line: "Drag on the pitch to draw a line.",
    zone: "Drag a rectangle over the area you want to highlight.",
    text: "Click the pitch where the note should go, then type it here.",
    erase: "Click any item on the pitch to remove it. Undo brings it back.",
  };
  return (
    <div className="grid gap-3 text-sm">
      <p className="text-muted-foreground">{hints[tool]}</p>
      {tool === "arrow" && <StylePicker value={arrowStyle} onChange={setArrowStyle} legend="Arrow type" />}
      <p className="text-xs text-muted-foreground">Press Esc or V to go back to selecting.</p>
    </div>
  );
}

function StylePicker({ value, onChange, legend }: { value: ArrowStyle; onChange: (s: ArrowStyle) => void; legend: string }) {
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      {(Object.keys(STYLE_LABELS) as ArrowStyle[]).map((st) => (
        <label key={st} className="flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 has-checked:border-primary has-checked:bg-accent has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
          <input type="radio" name={legend} value={st} checked={value === st} onChange={() => onChange(st)} className="accent-primary" />
          {STYLE_LABELS[st]}
        </label>
      ))}
    </fieldset>
  );
}

function SelectionProps({ o, players }: { o: BoardObject; players: Player[] }) {
  const dispatch = useEditor((s) => s.dispatch);
  const setArrowStyle = useEditor((s) => s.setArrowStyle);
  const board = useEditor((s) => s.board);
  const pos = position(o);
  const moveTo = (to: { x: number; y: number }) => dispatch({ type: "move", id: o.id, to });

  return (
    <div className="grid gap-3 text-sm">
      {o.kind === "player" && o.team === "home" && <SquadPicker marker={o} players={players} usedIds={board.objects.flatMap((x) => (x.kind === "player" && x.playerId && x.id !== o.id ? [x.playerId] : []))} />}
      {o.kind === "player" && <LabelField key={o.label} marker={o} />}
      {o.kind === "arrow" && (
        <StylePicker
          legend="Arrow type"
          value={o.style}
          onChange={(style) => {
            dispatch({ type: "set-arrow-style", id: o.id, style });
            setArrowStyle(style); // last used style becomes the default for the next arrow
          }}
        />
      )}
      {o.kind === "text" && <TextField key={o.text} id={o.id} text={o.text} />}
      {o.kind === "zone" && <ZoneFields key={`${o.label}|${o.color}`} zone={o} />}

      {o.kind === "arrow" || o.kind === "line" ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <CoordField key={`fx${o.from.x}`} label="Start x" value={o.from.x} onCommit={(x) => dispatch({ type: "set-endpoint", id: o.id, end: "from", to: { ...o.from, x } })} />
            <CoordField key={`fy${o.from.y}`} label="Start y" value={o.from.y} onCommit={(y) => dispatch({ type: "set-endpoint", id: o.id, end: "from", to: { ...o.from, y } })} />
            <CoordField key={`tx${o.to.x}`} label="End x" value={o.to.x} onCommit={(x) => dispatch({ type: "set-endpoint", id: o.id, end: "to", to: { ...o.to, x } })} />
            <CoordField key={`ty${o.to.y}`} label="End y" value={o.to.y} onCommit={(y) => dispatch({ type: "set-endpoint", id: o.id, end: "to", to: { ...o.to, y } })} />
          </div>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <CoordField key={`x${pos.x}`} label="Across (x)" value={pos.x} onCommit={(x) => moveTo({ x, y: pos.y })} />
          <CoordField key={`y${pos.y}`} label="Along (y)" value={pos.y} onCommit={(y) => moveTo({ x: pos.x, y })} />
          {o.kind === "zone" && (
            <>
              <CoordField key={`w${o.w}`} label="Width" value={o.w} onCommit={(w) => dispatch({ type: "set-zone-rect", id: o.id, a: { x: o.x, y: o.y }, b: { x: o.x + w, y: o.y + o.h } })} />
              <CoordField key={`h${o.h}`} label="Height" value={o.h} onCommit={(h) => dispatch({ type: "set-zone-rect", id: o.id, a: { x: o.x, y: o.y }, b: { x: o.x + o.w, y: o.y + h } })} />
            </>
          )}
        </div>
      )}
      <Button variant="destructive" size="sm" onClick={() => dispatch({ type: "remove", id: o.id })}>
        <Trash2 aria-hidden /> Remove from board
      </Button>
    </div>
  );
}

/** Text entry for a freshly placed note: Enter commits (one history step), Esc cancels. */
function NewTextPanel() {
  const pendingText = useEditor((s) => s.pendingText)!;
  const placeText = useEditor((s) => s.placeText);
  const dispatch = useEditor((s) => s.dispatch);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  // The click that placed the text focuses the pitch after this mounts, so focus on the next frame.
  useEffect(() => {
    const raf = requestAnimationFrame(() => ref.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, []);
  const commit = () => {
    if (!value.trim()) return setError("Type something first, or press Esc to cancel.");
    if (dispatch({ type: "add-text", at: pendingText, text: value })) placeText(null);
  };
  return (
    <div className="grid gap-1.5 text-sm">
      <Label htmlFor="new-text">Note on the pitch</Label>
      <input
        id="new-text"
        ref={ref}
        className={inputCls}
        maxLength={MAX_TEXT}
        value={value}
        placeholder="e.g. Press their left back"
        aria-invalid={error ? true : undefined}
        aria-describedby="new-text-help"
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            e.stopPropagation();
            placeText(null);
          }
        }}
      />
      <p id="new-text-help" className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}>
        {error ?? `Enter to add · Esc to cancel · ${value.length}/${MAX_TEXT}`}
      </p>
    </div>
  );
}

function TextField({ id, text }: { id: string; text: string }) {
  const dispatch = useEditor((s) => s.dispatch);
  const [value, setValue] = useState(text);
  const commit = () => {
    if (value === text) return;
    if (!value.trim()) return setValue(text);
    dispatch({ type: "edit-text", id, text: value });
  };
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="text-content">Text</Label>
      <input
        id="text-content"
        className={inputCls}
        maxLength={MAX_TEXT}
        value={value}
        aria-describedby="text-content-help"
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            e.stopPropagation();
            setValue(text);
          }
        }}
      />
      <p id="text-content-help" className="text-xs text-muted-foreground">
        Enter saves · Esc reverts · {value.length}/{MAX_TEXT}
      </p>
    </div>
  );
}

const ZONE_COLOR_NAMES: Record<string, string> = { "#facc15": "Yellow", "#38bdf8": "Blue", "#f87171": "Red", "#a78bfa": "Purple", "#ffffff": "White" };

function ZoneFields({ zone }: { zone: Extract<BoardObject, { kind: "zone" }> }) {
  const dispatch = useEditor((s) => s.dispatch);
  const [label, setLabel] = useState(zone.label ?? "");
  return (
    <>
      <div className="grid gap-1.5">
        <Label htmlFor="zone-label">Label (optional)</Label>
        <input
          id="zone-label"
          className={inputCls}
          maxLength={40}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => label !== (zone.label ?? "") && dispatch({ type: "update-zone", id: zone.id, label })}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              e.stopPropagation();
              setLabel(zone.label ?? "");
            }
          }}
        />
      </div>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Colour</legend>
        <div className="flex flex-wrap gap-1.5">
          {ZONE_COLORS.map((c) => (
            <label key={c} title={ZONE_COLOR_NAMES[c]} className="flex cursor-pointer items-center gap-1.5 rounded-full border py-0.5 pr-2 pl-0.5 text-xs has-checked:border-foreground has-checked:font-medium has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
              <input type="radio" name="zone-color" value={c} checked={zone.color === c} onChange={() => dispatch({ type: "update-zone", id: zone.id, color: c })} className="sr-only" />
              <span aria-hidden className="size-4 rounded-full ring-1 ring-black/15" style={{ backgroundColor: c }} />
              {ZONE_COLOR_NAMES[c]}
            </label>
          ))}
        </div>
      </fieldset>
    </>
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
