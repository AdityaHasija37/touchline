"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Viewer } from "@/components/slides/viewer";
import { FindMe } from "./find-me";
import { buildSlides } from "@/lib/domain/slides";
import type { Snapshot } from "@/lib/domain/snapshot";

type State = { kind: "loading" } | { kind: "ok"; snapshot: Snapshot } | { kind: "unavailable" } | { kind: "limited" } | { kind: "error" };

export function PublicBriefing() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let current = 0;
    const load = async () => {
      // Each load gets a ticket; a newer link (hash change) supersedes any request still in flight.
      const ticket = ++current;
      const token = window.location.hash.slice(1);
      setState({ kind: "loading" });
      if (!token) return setState({ kind: "unavailable" });
      try {
        const res = await fetch("/api/briefing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }), cache: "no-store" });
        if (ticket !== current) return;
        if (res.status === 429) return setState({ kind: "limited" });
        if (res.status === 404) return setState({ kind: "unavailable" });
        if (!res.ok) return setState({ kind: "error" });
        const body = (await res.json()) as { snapshot: Snapshot };
        if (ticket === current) setState({ kind: "ok", snapshot: body.snapshot });
      } catch {
        if (ticket === current) setState({ kind: "error" });
      }
    };
    void load();
    // Opening another share link in the same tab only changes the fragment, with no page load.
    window.addEventListener("hashchange", load);
    return () => {
      current++;
      window.removeEventListener("hashchange", load);
    };
  }, []);

  if (state.kind === "ok") return <Briefing snapshot={state.snapshot} />;

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

function Briefing({ snapshot: s }: { snapshot: Snapshot }) {
  const [me, setMe] = useState<string | undefined>();
  const slides = buildSlides(s);
  const name = [...s.lineup.starters, ...s.lineup.bench].find((p) => p.key === me)?.name;
  // Snapshots published before player keys existed can't support Find me.
  const canFind = [...s.lineup.starters, ...s.lineup.bench].some((p) => p.key);
  return (
    <Viewer
      slides={slides}
      teamColor={s.team.color}
      format={s.match.format}
      me={me}
      matchLabel={`${s.team.name} vs ${s.match.opponent}`}
      banner={
        <>
          <p className="sr-only">Read-only matchday briefing.</p>
          {name && (
            <p className="flex items-center justify-center gap-2 bg-yellow-300 px-4 py-1.5 text-sm font-medium text-zinc-900" role="status">
              Highlighting {name}
              <button type="button" onClick={() => setMe(undefined)} className="rounded px-1.5 underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:outline-none">
                Clear
              </button>
            </p>
          )}
        </>
      }
      actions={
        <>
          {canFind && <FindMe snapshot={s} slides={slides} onHighlight={setMe} />}
          <DownloadPdf />
        </>
      }
    />
  );
}

/** EXP-01 for players: POSTs the token (never a URL) and saves the returned PDF. */
function DownloadPdf() {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const download = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch("/api/briefing/pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: window.location.hash.slice(1) }) });
      if (!res.ok) throw new Error(String(res.status));
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "briefing.pdf";
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={download}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-zinc-300 hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none disabled:opacity-60"
    >
      <Download className="size-4" aria-hidden />
      {busy ? "Preparing…" : failed ? "Retry PDF" : "PDF"}
      <span className="sr-only"> download of this briefing</span>
    </button>
  );
}
