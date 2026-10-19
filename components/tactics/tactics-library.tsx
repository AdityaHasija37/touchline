"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy, LayoutTemplate, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import { LocalTime } from "@/components/app/local-time";
import { BoardSvg } from "@/components/board/board-svg";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deleteTactic, duplicateTactic } from "@/app/(app)/app/tactics/actions";
import type { Formation } from "@/lib/domain/formations";
import { formatLabel } from "@/lib/domain/format";
import type { Team } from "@/lib/db/teams";
import type { TacticSummary } from "@/lib/db/tactics";
import { CATEGORY_LABELS } from "@/lib/validation/board";
import { NewTacticDialog } from "./new-tactic-dialog";

export function TacticsLibrary({ team, tactics, formations }: { team: Team; tactics: TacticSummary[]; formations: Formation[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<TacticSummary | null>(null);
  const [pending, startTransition] = useTransition();

  const duplicate = (t: TacticSummary) =>
    startTransition(async () => {
      const res = await duplicateTactic(t.id);
      if (res.status === "success") toast.success(res.message);
      else if (res.status === "error") toast.error(res.message ?? "Couldn't duplicate.");
      router.refresh();
    });

  const confirmDelete = () =>
    startTransition(async () => {
      if (!deleting) return;
      const res = await deleteTactic(deleting.id);
      if (res.status === "success") toast.success(res.message);
      else if (res.status === "error") toast.error(res.message ?? "Couldn't delete.");
      setDeleting(null);
      router.refresh();
    });

  return (
    <>
      {tactics.length === 0 ? (
        <EmptyState
          icon={<LayoutTemplate className="size-10" aria-hidden />}
          title="No tactics yet"
          description="Start with a formation or a blank pitch."
          action={
            <Button size="lg" onClick={() => setCreating(true)}>
              <Plus aria-hidden /> Create tactic
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {tactics.length} tactic{tactics.length === 1 ? "" : "s"}
            </p>
            <Button onClick={() => setCreating(true)}>
              <Plus aria-hidden /> New tactic
            </Button>
          </div>
          <ul className="grid gap-4 md:grid-cols-2" aria-label="Tactics">
            {tactics.map((t) => (
              <li key={t.id} className="min-w-0">
                <article className="flex h-full gap-4 rounded-2xl border bg-card p-4 shadow-xs">
                  <Link
                    href={`/app/tactics/${t.id}`}
                    className="w-24 shrink-0 overflow-hidden rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    tabIndex={-1}
                    aria-hidden
                  >
                    {t.board ? <BoardSvg board={t.board} teamColor={team.primaryColor} showLabels={false} decorative /> : <div className="aspect-[68/105] bg-muted" />}
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <h2 className="truncate font-semibold">
                      <Link href={`/app/tactics/${t.id}`} className="hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                        {t.name}
                      </Link>
                    </h2>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant="secondary">{CATEGORY_LABELS[t.category]}</Badge>
                      <span>{formatLabel(t.format)}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      <LocalTime iso={t.updatedAt} prefix="Edited " />
                    </p>
                    <div className="mt-auto flex gap-1 pt-3">
                      <Button variant="ghost" size="sm" disabled={pending} onClick={() => duplicate(t)} aria-label={`Duplicate ${t.name}`}>
                        <Copy aria-hidden /> Duplicate
                      </Button>
                      <Button variant="ghost" size="sm" disabled={pending} onClick={() => setDeleting(t)} aria-label={`Delete ${t.name}`}>
                        <Trash2 aria-hidden /> Delete
                      </Button>
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </div>
      )}

      <NewTacticDialog open={creating} onOpenChange={setCreating} team={team} formations={formations} />

      <Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete “{deleting?.name}”?</DialogTitle>
            <DialogDescription>
              This permanently deletes this tactics board. Briefings you&apos;ve already published keep their own copy.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={pending} onClick={confirmDelete}>
              {pending ? "Deleting…" : "Delete tactic"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
