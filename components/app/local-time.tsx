"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** Renders a timestamp in the viewer's own time zone (avoids server/client hydration drift). */
export function LocalTime({ iso, prefix }: { iso: string; prefix?: string }) {
  const text = useSyncExternalStore(
    subscribe,
    () => new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso)),
    () => "",
  );
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {text ? `${prefix ?? ""}${text}` : ""}
    </time>
  );
}
