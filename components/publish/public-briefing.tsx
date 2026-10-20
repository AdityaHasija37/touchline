"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Viewer } from "@/components/slides/viewer";
import { buildSlides } from "@/lib/domain/slides";
import type { Snapshot } from "@/lib/domain/snapshot";

type State = { kind: "loading" } | { kind: "ok"; snapshot: Snapshot } | { kind: "unavailable" } | { kind: "limited" } | { kind: "error" };

export function PublicBriefing() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const token = window.location.hash.slice(1);
    let cancelled = false;
    const load = async () => {
      if (!token) return setState({ kind: "unavailable" });
      try {
        const res = await fetch("/api/briefing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }), cache: "no-store" });
        if (cancelled) return;
        if (res.status === 429) return setState({ kind: "limited" });
        if (res.status === 404) return setState({ kind: "unavailable" });
        if (!res.ok) return setState({ kind: "error" });
        const body = (await res.json()) as { snapshot: Snapshot };
        setState({ kind: "ok", snapshot: body.snapshot });
      } catch {
        if (!cancelled) setState({ kind: "error" });
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === "ok") {
    const s = state.snapshot;
    return (
      <Viewer
        slides={buildSlides(s)}
        teamColor={s.team.color}
        matchLabel={`${s.team.name} vs ${s.match.opponent}`}
        banner={<p className="sr-only">Read-only matchday briefing.</p>}
      />
    );
  }

  const message = {
    loading: { title: "Loading briefing…", body: "" },
    unavailable: { title: "Briefing unavailable", body: "This link doesn't work. It may have been replaced or switched off by the team captain. Ask them for the current link." },
    limited: { title: "Too many attempts", body: "Please wait a minute and try again." },
    error: { title: "Couldn't load the briefing", body: "Check your connection and try again." },
  }[state.kind];

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center text-zinc-100">
      <Logo className="text-zinc-100" />
      <h1 className="text-2xl font-semibold" aria-live="polite">
        {message.title}
      </h1>
      {message.body && <p className="max-w-sm text-zinc-400">{message.body}</p>}
    </div>
  );
}
