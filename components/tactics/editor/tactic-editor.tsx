"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useStore } from "zustand";
import { AlertTriangle, ArrowUpRight, Circle as BallIcon, Eraser, MousePointer2, Redo2, RefreshCw, Slash, Square, Type, Undo2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { BoardSvg } from "@/components/board/board-svg";
import { LocalTime } from "@/components/app/local-time";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { renameTactic, saveBoardAsCopy } from "@/app/(app)/app/tactics/actions";
import { countMarkers } from "@/lib/domain/board-ops";
import { formatLabel, type MatchFormat } from "@/lib/domain/format";
import type { Player } from "@/lib/db/teams";
import { CATEGORY_LABELS, TACTIC_CATEGORIES, type Board, type TacticCategory } from "@/lib/validation/board";
import { cn } from "@/lib/utils";
import { EditorContext } from "./context";
import { Inspector } from "./inspector";
import { createEditorStore, type EditorStore, type Tool } from "./store";
import { useSaver } from "./use-saver";

const PitchCanvas = dynamic(() => import("./pitch-canvas"), {
  ssr: false,
  loading: () => <Skeleton className="absolute inset-0 rounded-none" aria-label="Loading pitch" />,
});

export type EditorProps = {
  tactic: { id: string; name: string; category: TacticCategory; format: MatchFormat; board: Board; version: number; updatedAt: string };
  team: { id: string; name: string; primaryColor: string };
  players: Player[];
};

const wideQuery = "(min-width: 1024px)";
const subscribeWide = (cb: () => void) => {
  const mq = window.matchMedia(wideQuery);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

export function TacticEditor(props: EditorProps) {
  const [store] = useState(() => createEditorStore({ board: props.tactic.board, version: props.tactic.version, savedAt: props.tactic.updatedAt }));
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia(wideQuery).matches, () => null);

  return (
    <EditorContext.Provider value={store}>
      {wide === null ? <Skeleton className="h-[70dvh] w-full rounded-2xl" /> : wide ? <EditorWorkspace {...props} store={store} /> : <ReadOnlyView {...props} />}
    </EditorContext.Provider>
  );
}

/** Below 1024 px the editor is view-only in MVP (UX-002 S05). */
function ReadOnlyView({ tactic, team }: EditorProps) {
  return (
    <div className="grid gap-4">
      <Breadcrumb team={team} />
      <h1 className="text-2xl font-semibold tracking-tight">{tactic.name}</h1>
      <p className="rounded-lg border bg-accent px-3 py-2 text-sm text-accent-foreground">
        Editing works on screens 1024px and wider. You can view this board here.
      </p>
      <div className="mx-auto w-full max-w-sm overflow-hidden rounded-xl">
        <BoardSvg board={tactic.board} teamColor={team.primaryColor} title={tactic.name} />
      </div>
    </div>
  );
}

function Breadcrumb({ team }: { team: EditorProps["team"] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
      <Link href={`/app/teams/${team.id}`} className="hover:underline">
        {team.name}
      </Link>
      <span aria-hidden> / </span>
      <Link href={`/app/teams/${team.id}/tactics`} className="hover:underline">
        Tactics
      </Link>
    </nav>
  );
}

function EditorWorkspace({ tactic, team, players, store }: EditorProps & { store: EditorStore }) {
  const router = useRouter();
  const { save, dirty } = useSaver(tactic.id, store);
  const board = useStore(store, (s) => s.board);
  const selectedId = useStore(store, (s) => s.selectedId);
  const saveState = useStore(store, (s) => s.saveState);
  const saveError = useStore(store, (s) => s.saveError);
  const savedAt = useStore(store, (s) => s.savedAt);
  const opError = useStore(store, (s) => s.opError);
  const dispatch = useStore(store, (s) => s.dispatch);
  const tool = useStore(store, (s) => s.tool);
  const setTool = useStore(store, (s) => s.setTool);
  const canUndo = useStore(store, (s) => s.canUndo);
  const canRedo = useStore(store, (s) => s.canRedo);
  const [copying, setCopying] = useState(false);

  // Editor-wide shortcuts (UX-002 §5). Text fields keep their own native undo and typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === "s") {
        e.preventDefault();
        void save();
        return;
      }
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      const st = store.getState();
      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
      } else if (mod && key === "y") {
        e.preventDefault();
        st.redo();
      } else if (!mod && !e.altKey && TOOL_KEYS[key]) {
        st.setTool(TOOL_KEYS[key]);
      } else if (key === "escape") {
        if (st.pendingText) st.placeText(null);
        else if (st.tool !== "select") st.setTool("select");
        else st.select(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, store]);

  useEffect(() => {
    if (opError) toast.error(opError);
  }, [opError]);

  const onPitchKey = (e: React.KeyboardEvent) => {
    if (!selectedId) return;
    const step = e.shiftKey ? 5 : 1;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const mv = moves[e.key];
    if (mv) {
      e.preventDefault();
      // Arrow keys move on screen; in horizontal orientation pitch axes are rotated.
      const [dx, dy] = board.orientation === "vertical" ? mv : [mv[1], -mv[0]];
      dispatch({ type: "nudge", id: selectedId, dx, dy });
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      dispatch({ type: "remove", id: selectedId });
    }
  };

  const saveCopy = async () => {
    setCopying(true);
    const res = await saveBoardAsCopy(tactic.id, store.getState().board);
    setCopying(false);
    if (res.status === "created") {
      // Local edits now live in the copy, so leaving this page without a warning is safe.
      store.getState().saveSucceeded(store.getState().board, store.getState().version, new Date().toISOString());
      toast.success("Saved your version as a new tactic.");
      router.push(`/app/tactics/${res.id}`);
    } else toast.error(res.message);
  };

  const home = countMarkers(board, "home");
  const away = countMarkers(board, "away");
  const hasBall = board.objects.some((o) => o.kind === "ball");

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <Breadcrumb team={team} />
          <TacticTitle id={tactic.id} initialName={tactic.name} initialCategory={tactic.category} format={tactic.format} />
        </div>
        <div className="flex items-center gap-3">
          <SaveStatus state={saveState} dirty={dirty} savedAt={savedAt} />
          <Button onClick={() => void save()} disabled={saveState === "saving" || saveState === "conflict" || (!dirty && saveState !== "error")}>
            Save
          </Button>
        </div>
      </header>

      {saveState === "error" && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          <span className="flex-1">{saveError ?? "Changes haven't synced. Your edits are still here."}</span>
          <Button size="sm" variant="outline" onClick={() => void save()}>
            <RefreshCw aria-hidden /> Retry save
          </Button>
        </div>
      )}
      {saveState === "conflict" && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          <span className="flex-1">
            This tactic was changed in another tab or device. To avoid overwriting it, your edits haven&apos;t been saved.
          </span>
          <Button size="sm" variant="outline" disabled={copying} onClick={() => void saveCopy()}>
            {copying ? "Saving copy…" : "Save mine as a copy"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              store.getState().saveSucceeded(store.getState().board, store.getState().version, new Date().toISOString());
              window.location.reload();
            }}
          >
            Discard mine and reload
          </Button>
        </div>
      )}

      <div className="grid h-[calc(100dvh-14rem)] min-h-[34rem] grid-cols-[3.25rem_1fr_18rem] overflow-hidden rounded-2xl border bg-card">
        <div role="toolbar" aria-label="Board tools" aria-orientation="vertical" className="flex flex-col items-center gap-1 border-r p-1.5">
          {TOOLS.map(([id, label, key, Icon]) => (
            <ToolButton key={id} label={`${label} (${key.toUpperCase()})`} active={tool === id} onClick={() => setTool(id)}>
              <Icon />
            </ToolButton>
          ))}
          <div className="my-1 h-px w-full bg-border" />
          <ToolButton label={`Add your player (${home}/${board.format})`} disabled={home >= board.format} onClick={() => dispatch({ type: "add-player", team: "home" })}>
            <UserPlus />
          </ToolButton>
          <ToolButton label={`Add opponent (${away}/${board.format})`} disabled={away >= board.format} onClick={() => dispatch({ type: "add-player", team: "away" })}>
            <Users />
          </ToolButton>
          <ToolButton label="Add ball" disabled={hasBall} onClick={() => dispatch({ type: "add-ball" })}>
            <BallIcon />
          </ToolButton>
        </div>

        <div
          className="relative min-w-0 focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-ring"
          tabIndex={0}
          role="application"
          aria-label={`Pitch, ${TOOLS.find((x) => x[0] === tool)![1].toLowerCase()} tool. Select an item, then use arrow keys to move it (Shift for bigger steps), Delete to remove, Escape to deselect.`}
          aria-describedby="pitch-help"
          onKeyDown={onPitchKey}
        >
          <PitchCanvas teamColor={team.primaryColor} />
        </div>

        <Inspector players={players} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1" role="group" aria-label="History">
          <Button variant="outline" size="sm" disabled={!canUndo} onClick={() => store.getState().undo()} aria-keyshortcuts="Control+Z Meta+Z">
            <Undo2 aria-hidden /> Undo
          </Button>
          <Button variant="outline" size="sm" disabled={!canRedo} onClick={() => store.getState().redo()} aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z">
            <Redo2 aria-hidden /> Redo
          </Button>
        </div>
        <p id="pitch-help" className="text-xs text-muted-foreground">
          Drag to move or draw · Arrow keys nudge (Shift ×5) · Delete removes · Esc cancels · {navigatorKey()}+Z undo, Shift+{navigatorKey()}+Z redo ·
          V A L Z T E switch tools · Changes save automatically.
        </p>
      </div>
    </div>
  );
}

const TOOLS: [Tool, string, string, typeof MousePointer2][] = [
  ["select", "Select and move", "v", MousePointer2],
  ["arrow", "Arrow", "a", ArrowUpRight],
  ["line", "Line", "l", Slash],
  ["zone", "Zone", "z", Square],
  ["text", "Text", "t", Type],
  ["erase", "Erase", "e", Eraser],
];
const TOOL_KEYS: Record<string, Tool> = Object.fromEntries(TOOLS.map(([id, , key]) => [key, id]));

function navigatorKey() {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl";
}

function ToolButton({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <Button
      variant={active ? "secondary" : "ghost"}
      size="icon"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(active && "bg-accent text-accent-foreground")}
    >
      {children}
    </Button>
  );
}

function SaveStatus({ state, dirty, savedAt }: { state: string; dirty: boolean; savedAt: string | null }) {
  let text: React.ReactNode;
  if (state === "saving") text = "Saving…";
  else if (state === "error") text = <span className="text-destructive">Not saved</span>;
  else if (state === "conflict") text = <span className="text-amber-700">Not saved: conflict</span>;
  else if (dirty) text = "Unsaved changes";
  else if (savedAt) text = <>All changes saved · <LocalTime iso={savedAt} /></>;
  else text = "All changes saved.";
  return (
    <p role="status" aria-live="polite" className="text-sm text-muted-foreground" data-testid="save-status">
      {text}
    </p>
  );
}

function TacticTitle({ id, initialName, initialCategory, format }: { id: string; initialName: string; initialCategory: TacticCategory; format: MatchFormat }) {
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState(initialCategory);
  const [committed, setCommitted] = useState({ name: initialName, category: initialCategory });
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  const commit = async (next: { name: string; category: TacticCategory }) => {
    if (next.name.trim() === committed.name && next.category === committed.category) return;
    setStatus("saving");
    const res = await renameTactic(id, next.name, next.category);
    if (res.status === "saved") {
      setCommitted({ name: res.name, category: next.category });
      setName(res.name);
      setError(null);
      setStatus("saved");
    } else {
      setError(res.message);
      setStatus("idle");
    }
  };

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <label htmlFor="tactic-name" className="sr-only">
        Tactic name
      </label>
      <input
        id="tactic-name"
        value={name}
        maxLength={60}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => void commit({ name, category })}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setName(committed.name);
            setError(null);
          }
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "tactic-name-error" : undefined}
        className="-ml-1 min-w-0 rounded-md bg-transparent px-1 text-2xl font-semibold tracking-tight outline-none hover:bg-muted focus-visible:bg-background focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <label htmlFor="tactic-category" className="sr-only">
        Tactic type
      </label>
      <select
        id="tactic-category"
        value={category}
        onChange={(e) => {
          const c = e.target.value as TacticCategory;
          setCategory(c);
          void commit({ name, category: c });
        }}
        className="h-7 rounded-md border bg-background px-1.5 text-sm text-muted-foreground"
      >
        {TACTIC_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {CATEGORY_LABELS[c]}
          </option>
        ))}
      </select>
      <span className="text-sm text-muted-foreground">{formatLabel(format)}</span>
      <span role="status" aria-live="polite" className="text-xs text-muted-foreground" data-testid="title-status">
        {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : ""}
      </span>
      {error && (
        <p id="tactic-name-error" className="w-full text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
