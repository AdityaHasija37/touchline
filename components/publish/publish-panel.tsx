"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Copy, Link2Off, MonitorPlay, RefreshCw, Send, ShieldAlert, XCircle } from "lucide-react";
import { toast } from "sonner";
import { LocalTime } from "@/components/app/local-time";
import { slideLabel } from "@/components/slides/slide-view";
import { SlideThumb } from "@/components/slides/slide-thumb";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { publishPlan, revokeLink, rotateLink } from "@/app/(app)/app/plans/actions";
import type { ReadinessItem } from "@/lib/domain/plan-readiness";
import type { SlideSpec } from "@/lib/domain/slides";

type Props = {
  planId: string;
  matchId: string;
  teamId: string;
  teamColor: string;
  title: string;
  kickoffLabel: string;
  slides: SlideSpec[];
  excludedTitles: string[];
  readiness: { ready: boolean; items: ReadinessItem[] };
  publication: { publishedAt: string; slideCount: number; changed: boolean } | null;
};

/** UX-002 S08: review exactly what players will see, then publish, republish, revoke or re-link. */
export function PublishPanel(p: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [link, setLink] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const blocking = p.readiness.items.filter((i) => i.level === "blocking");
  const live = Boolean(p.publication);

  const run = (fn: () => Promise<void>) => startTransition(fn);

  const publish = () =>
    run(async () => {
      const res = await publishPlan(p.planId);
      if (res.status === "published") {
        setLink(res.url);
        toast.success("Published. Copy the link and share it with your players.");
      } else if (res.status === "republished") toast.success("Briefing updated. Players with the link now see this version.");
      else if (res.status === "blocked") toast.error(res.reasons[0]);
      else toast.error(res.message);
      router.refresh();
    });

  const rotate = () =>
    run(async () => {
      const res = await rotateLink(p.planId);
      if (res.status === "rotated") {
        setLink(res.url);
        toast.success("New link created. The old link no longer works.");
      } else toast.error(res.message);
      router.refresh();
    });

  const revoke = () =>
    run(async () => {
      const res = await revokeLink(p.planId);
      setConfirmRevoke(false);
      setLink(null);
      if (res.status === "revoked") toast.success("Link revoked. Anyone opening it now sees “briefing unavailable”.");
      else toast.error(res.message);
      router.refresh();
    });

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copied.");
    } catch {
      toast.error("Couldn't copy automatically. Select the link and copy it.");
    }
  };

  return (
    <div className="grid gap-6 [&>*]:min-w-0">
      <header>
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <Link href={`/app/teams/${p.teamId}/matches`} className="hover:underline">
            Matches
          </Link>
          <span aria-hidden> / </span>
          <Link href={`/app/matches/${p.matchId}/plan`} className="hover:underline">
            {p.title}
          </Link>
        </nav>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Preview &amp; publish</h1>
        <p className="text-muted-foreground">{p.kickoffLabel}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="preview-heading" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="preview-heading" className="font-semibold">
              What players will see ({p.slides.length} slides)
            </h2>
            <Link href={`/app/plans/${p.planId}/present?source=draft`} className="text-sm text-primary underline-offset-4 hover:underline">
              Preview full screen
            </Link>
          </div>
          {p.excludedTitles.length > 0 && (
            <p className="mb-3 rounded-lg border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              Not included: {p.excludedTitles.map((t) => `“${t}”`).join(", ")}. Private notes are never included.
            </p>
          )}
          <ol className="grid gap-4 sm:grid-cols-2" aria-label="Slide preview">
            {p.slides.map((s, i) => (
              <li key={s.id} className="min-w-0">
                <p className="mb-1 text-xs text-muted-foreground">
                  {i + 1}. {slideLabel(s)}
                </p>
                <div className="overflow-hidden rounded-lg border shadow-xs">
                  <SlideThumb slide={s} teamColor={p.teamColor} />
                </div>
              </li>
            ))}
          </ol>
        </section>

        <aside className="grid content-start gap-4">
          <section aria-labelledby="link-heading" className="rounded-2xl border bg-card p-4">
            <h2 id="link-heading" className="mb-1 font-semibold">
              Player link
            </h2>
            <p className="mb-3 text-sm text-muted-foreground" data-testid="link-state">
              {live ? (
                <>
                  Live · published <LocalTime iso={p.publication!.publishedAt} />
                </>
              ) : (
                "Not published. Only you can see this plan."
              )}
            </p>

            {live && p.publication!.changed && (
              <p className="mb-3 flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                Your draft has changes players can&apos;t see yet. Republish to update the link.
              </p>
            )}

            {blocking.length > 0 && (
              <ul className="mb-3 grid gap-1.5" aria-label="Required before publishing">
                {blocking.map((b) => (
                  <li key={b.id} className="flex gap-2 text-sm">
                    <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="Required" />
                    {b.message}
                  </li>
                ))}
              </ul>
            )}
            {blocking.length === 0 && !live && (
              <p className="mb-3 flex gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /> Ready to publish.
              </p>
            )}

            <Button className="w-full" disabled={pending || blocking.length > 0 || (live && !p.publication!.changed)} onClick={publish}>
              <Send aria-hidden /> {!live ? "Publish briefing" : p.publication!.changed ? "Republish changes" : "Up to date"}
            </Button>

            {link && (
              <div className="mt-3 grid gap-2 rounded-lg border border-primary/30 bg-accent p-3">
                <label htmlFor="share-link" className="text-sm font-medium text-accent-foreground">
                  Share this link
                </label>
                <input id="share-link" readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="h-8 w-full rounded-md border bg-background px-2 font-mono text-xs" />
                <Button size="sm" onClick={copy}>
                  <Copy aria-hidden /> Copy link
                </Button>
                <p className="text-xs text-accent-foreground">
                  For your security we only show this link now. If you lose it, create a new one below.
                </p>
              </div>
            )}

            <p className="mt-3 flex gap-2 text-xs text-muted-foreground">
              <ShieldAlert className="size-4 shrink-0" aria-hidden />
              Anyone with this link can view the published briefing. You can revoke access at any time.
            </p>

            {live && (
              <div className="mt-3 grid gap-2 border-t pt-3">
                <Link href={`/app/plans/${p.planId}/present`} className={buttonVariants({ variant: "outline" })}>
                  <MonitorPlay aria-hidden /> Present published briefing
                </Link>
                <Button variant="outline" disabled={pending} onClick={rotate}>
                  <RefreshCw aria-hidden /> Get a new link
                </Button>
                <Button variant="destructive" disabled={pending} onClick={() => setConfirmRevoke(true)}>
                  <Link2Off aria-hidden /> Revoke link
                </Button>
              </div>
            )}
          </section>
        </aside>
      </div>

      <Dialog open={confirmRevoke} onOpenChange={setConfirmRevoke}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke the player link?</DialogTitle>
            <DialogDescription>
              Players who open the link will see “briefing unavailable”. Your plan stays here as a draft, and you can publish again for a new link.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRevoke(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={pending} onClick={revoke}>
              Revoke link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
