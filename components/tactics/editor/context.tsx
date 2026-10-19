"use client";

import { createContext, useContext } from "react";
import { useStore } from "zustand";
import type { EditorState, EditorStore } from "./store";

export const EditorContext = createContext<EditorStore | null>(null);

export function useEditor<T>(selector: (s: EditorState) => T): T {
  const store = useContext(EditorContext);
  if (!store) throw new Error("useEditor must be used inside <EditorContext>");
  return useStore(store, selector);
}

export function useEditorStore(): EditorStore {
  const store = useContext(EditorContext);
  if (!store) throw new Error("useEditorStore must be used inside <EditorContext>");
  return store;
}
