"use client";

import { useRef, useState } from "react";

export type SaveState = { status: "idle" | "saving" | "saved" } | { status: "error"; message: string };
type Result = { status: "saved" } | { status: "error"; message: string };

/** Saves the latest value only, one request at a time, so the server always ends with the newest edit. */
export function useSerialSave<T>(save: (value: T) => Promise<Result>) {
  const [state, setState] = useState<SaveState>({ status: "idle" });
  const latest = useRef<{ value: T } | null>(null);
  const running = useRef(false);

  const flush = async () => {
    if (running.current) return;
    running.current = true;
    try {
      while (latest.current) {
        const { value } = latest.current;
        latest.current = null;
        setState({ status: "saving" });
        const res = await save(value).catch(() => ({ status: "error" as const, message: "Couldn't reach the server. Your changes are still here." }));
        if (res.status === "error") return setState({ status: "error", message: res.message });
      }
      setState({ status: "saved" });
    } finally {
      running.current = false;
    }
  };

  return {
    state,
    queue: (value: T) => {
      latest.current = { value };
      void flush();
    },
  };
}
