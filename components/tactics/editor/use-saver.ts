"use client";

import { useEffect, useState } from "react";
import { useStore } from "zustand";
import { saveTacticBoard } from "@/app/(app)/app/tactics/actions";
import type { EditorStore } from "./store";

const AUTOSAVE_MS = 1500;
const NOT_SYNCED = "Changes haven't synced. Your edits are still here.";

/** One save pipeline per editor: serialises requests and re-saves edits made while one was in flight. */
function createSaver(tacticId: string, store: EditorStore) {
  let inFlight = false;
  let queued = false;

  async function save(): Promise<void> {
    const s = store.getState();
    if (s.saveState === "conflict") return;
    if (inFlight) {
      queued = true;
      return;
    }
    if (s.board === s.savedBoard && s.saveState !== "error") return;
    inFlight = true;
    const sent = s.board;
    s.saveStarted();
    try {
      const res = await saveTacticBoard(tacticId, sent, s.version);
      const st = store.getState();
      if (res.status === "saved") st.saveSucceeded(sent, res.version, res.savedAt);
      else if (res.status === "conflict") st.saveConflicted();
      else if (res.status === "invalid") st.saveFailed(res.message);
      else if (res.status === "not_found") st.saveFailed("This tactic no longer exists. Save a copy to keep your work.");
      else st.saveFailed(NOT_SYNCED);
    } catch {
      store.getState().saveFailed(NOT_SYNCED);
    } finally {
      inFlight = false;
      const again = queued;
      queued = false;
      const st = store.getState();
      if (again && st.saveState === "saved" && st.board !== st.savedBoard) void save();
    }
  }

  return save;
}

/**
 * Save pipeline (TAC-03, UX-002 §5/§7): debounced autosave plus explicit save. Success is only
 * shown after the server acknowledges; failures keep local edits; conflicts stop autosave.
 */
export function useSaver(tacticId: string, store: EditorStore) {
  const [save] = useState(() => createSaver(tacticId, store));
  const board = useStore(store, (s) => s.board);
  const savedBoard = useStore(store, (s) => s.savedBoard);
  const saveState = useStore(store, (s) => s.saveState);
  const dirty = board !== savedBoard;

  // Autosave after a pause in editing. Errors wait for an explicit retry; conflicts stop it.
  useEffect(() => {
    if (!dirty || saveState === "conflict" || saveState === "error" || saveState === "saving") return;
    const t = setTimeout(() => void save(), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [board, dirty, saveState, save]);

  // Warn before leaving with unsynced edits.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  return { save, dirty };
}
