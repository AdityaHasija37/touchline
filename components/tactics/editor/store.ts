import { createStore } from "zustand/vanilla";
import { applyOp, BoardOpError, type BoardOp } from "@/lib/domain/board-ops";
import type { Board } from "@/lib/validation/board";

export type SaveState = "idle" | "saving" | "saved" | "error" | "conflict";

export type EditorState = {
  board: Board;
  /** The last board the server acknowledged; `board !== savedBoard` means unsaved changes. */
  savedBoard: Board;
  version: number;
  selectedId: string | null;
  saveState: SaveState;
  savedAt: string | null;
  saveError: string | null;
  opError: string | null;
  dispatch: (op: BoardOp) => boolean;
  select: (id: string | null) => void;
  clearOpError: () => void;
  saveStarted: () => void;
  saveSucceeded: (sent: Board, version: number, savedAt: string) => void;
  saveFailed: (message: string) => void;
  saveConflicted: () => void;
};

export function createEditorStore(init: { board: Board; version: number; savedAt: string }) {
  return createStore<EditorState>()((set, get) => ({
    board: init.board,
    savedBoard: init.board,
    version: init.version,
    selectedId: null,
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
            : op.type === "add-player" || op.type === "add-ball"
              ? next.objects[next.objects.length - 1].id
              : get().selectedId;
        set({ board: next, selectedId, opError: null });
        return true;
      } catch (e) {
        if (e instanceof BoardOpError) {
          set({ opError: e.message });
          return false;
        }
        throw e;
      }
    },
    select: (id) => set({ selectedId: id }),
    clearOpError: () => set({ opError: null }),
    saveStarted: () => set({ saveState: "saving", saveError: null }),
    // Only clears "dirty" if nothing changed while the request was in flight.
    saveSucceeded: (sent, version, savedAt) => set({ savedBoard: sent, version, savedAt, saveState: "saved", saveError: null }),
    saveFailed: (message) => set({ saveState: "error", saveError: message }),
    saveConflicted: () => set({ saveState: "conflict" }),
  }));
}

export type EditorStore = ReturnType<typeof createEditorStore>;
