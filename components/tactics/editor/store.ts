import { createStore } from "zustand/vanilla";
import { applyOp, BoardOpError, type ArrowStyle, type BoardOp } from "@/lib/domain/board-ops";
import { canRedo, canUndo, createHistory, record, redo, undo, type History } from "@/lib/domain/history";
import type { PitchPoint } from "@/lib/domain/pitch";
import type { Board } from "@/lib/validation/board";

export type SaveState = "idle" | "saving" | "saved" | "error" | "conflict";
export type Tool = "select" | "arrow" | "line" | "zone" | "text" | "erase";

export type EditorState = {
  board: Board;
  history: History<Board>;
  canUndo: boolean;
  canRedo: boolean;
  /** The last board the server acknowledged; `board !== savedBoard` means unsaved changes. */
  savedBoard: Board;
  version: number;
  selectedId: string | null;
  tool: Tool;
  arrowStyle: ArrowStyle;
  /** Text placed on the pitch but not yet committed (UX-002 §5: Enter commits, Esc cancels). */
  pendingText: PitchPoint | null;
  saveState: SaveState;
  savedAt: string | null;
  saveError: string | null;
  opError: string | null;
  dispatch: (op: BoardOp) => boolean;
  undo: () => void;
  redo: () => void;
  select: (id: string | null) => void;
  setTool: (tool: Tool) => void;
  setArrowStyle: (style: ArrowStyle) => void;
  placeText: (at: PitchPoint | null) => void;
  clearOpError: () => void;
  saveStarted: () => void;
  saveSucceeded: (sent: Board, version: number, savedAt: string) => void;
  saveFailed: (message: string) => void;
  saveConflicted: () => void;
};

const ADDS = new Set(["add-player", "add-ball", "add-arrow", "add-line", "add-zone", "add-text"]);

export function createEditorStore(init: { board: Board; version: number; savedAt: string }) {
  return createStore<EditorState>()((set, get) => {
    const fromHistory = (history: History<Board>) => ({
      history,
      board: history.present,
      canUndo: canUndo(history),
      canRedo: canRedo(history),
    });
    const keepSelection = (board: Board) => {
      const id = get().selectedId;
      return id && board.objects.some((o) => o.id === id) ? id : null;
    };

    return {
      ...fromHistory(createHistory(init.board)),
      savedBoard: init.board,
      version: init.version,
      selectedId: null,
      tool: "select",
      arrowStyle: "run",
      pendingText: null,
      saveState: "idle",
      savedAt: init.savedAt,
      saveError: null,
      opError: null,

      dispatch: (op) => {
        try {
          const next = applyOp(get().board, op);
          const selectedId =
            op.type === "remove" && get().selectedId === op.id
              ? null
              : ADDS.has(op.type)
                ? next.objects[next.objects.length - 1].id
                : get().selectedId;
          set({ ...fromHistory(record(get().history, next)), selectedId, opError: null });
          return true;
        } catch (e) {
          if (e instanceof BoardOpError) {
            set({ opError: e.message });
            return false;
          }
          throw e;
        }
      },
      undo: () => {
        const h = undo(get().history);
        if (h === get().history) return;
        set({ ...fromHistory(h), pendingText: null, selectedId: keepSelection(h.present) });
      },
      redo: () => {
        const h = redo(get().history);
        if (h === get().history) return;
        set({ ...fromHistory(h), pendingText: null, selectedId: keepSelection(h.present) });
      },
      select: (id) => set({ selectedId: id, pendingText: null }),
      setTool: (tool) => set({ tool, pendingText: null, selectedId: tool === "select" ? get().selectedId : null }),
      setArrowStyle: (arrowStyle) => set({ arrowStyle }),
      placeText: (at) => set({ pendingText: at, selectedId: null }),
      clearOpError: () => set({ opError: null }),
      saveStarted: () => set({ saveState: "saving", saveError: null }),
      // Only clears "dirty" if nothing changed while the request was in flight.
      saveSucceeded: (sent, version, savedAt) => set({ savedBoard: sent, version, savedAt, saveState: "saved", saveError: null }),
      saveFailed: (message) => set({ saveState: "error", saveError: message }),
      saveConflicted: () => set({ saveState: "conflict" }),
    };
  });
}

export type EditorStore = ReturnType<typeof createEditorStore>;
