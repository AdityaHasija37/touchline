"use client";

import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, Pencil, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { addPlayer, setPlayerArchived, updatePlayer } from "@/app/(app)/app/teams/actions";
import type { Player } from "@/lib/db/teams";
import type { MatchFormat } from "@/lib/domain/format";
import { POSITION_LABELS } from "@/lib/validation/player";
import { PlayerForm } from "./player-form";

export function SquadManager({ teamId, matchFormat, players }: { teamId: string; matchFormat: MatchFormat; players: Player[] }) {
  const active = players.filter((p) => !p.archivedAt);
  const archived = players.filter((p) => p.archivedAt);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Player | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [pending, startTransition] = useTransition();

  const toggleArchive = (p: Player, archive: boolean) =>
    startTransition(async () => {
      const res = await setPlayerArchived(p.id, archive);
      if (res.status === "success") toast.success(res.message);
      else if (res.status === "error") toast.error(res.message ?? "Something went wrong.");
    });

  const addForm = (
    <section aria-labelledby="add-player-heading" className="rounded-2xl border bg-card p-5">
      <h2 id="add-player-heading" className="mb-4 font-semibold">Add a player</h2>
      <PlayerForm
        idPrefix="add"
        action={addPlayer.bind(null, teamId)}
        submitLabel="Add player"
        pendingLabel="Adding…"
        resetOnSuccess
        footer={
          active.length > 0 && (
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              Done
            </Button>
          )
        }
      />
    </section>
  );

  if (players.length === 0 && !adding) {
    return (
      <EmptyState
        icon={<UserPlus className="size-10" aria-hidden />}
        title="No players yet"
        description="Add your first player to start building a lineup."
        action={
          <Button size="lg" onClick={() => setAdding(true)}>
            <UserPlus aria-hidden /> Add player
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {active.length} active player{active.length === 1 ? "" : "s"}
          {active.length < matchFormat && ` · ${matchFormat - active.length} short of a full ${matchFormat}`}
        </p>
        {!adding && (
          <Button onClick={() => setAdding(true)}>
            <UserPlus aria-hidden /> Add player
          </Button>
        )}
      </div>

      {adding && addForm}

      {active.length > 0 && (
        <ul className="divide-y rounded-2xl border bg-card" aria-label="Active players">
          {active.map((p) => (
            <PlayerRow key={p.id} player={p} disabled={pending}>
              <Button variant="ghost" size="sm" onClick={() => setEditing(p)} aria-label={`Edit ${p.name}`}>
                <Pencil aria-hidden /> <span className="hidden sm:inline">Edit</span>
              </Button>
              <Button variant="ghost" size="sm" disabled={pending} onClick={() => toggleArchive(p, true)} aria-label={`Archive ${p.name}`}>
                <Archive aria-hidden /> <span className="hidden sm:inline">Archive</span>
              </Button>
            </PlayerRow>
          ))}
        </ul>
      )}

      {archived.length > 0 && (
        <section aria-labelledby="archived-heading">
          <Button
            variant="link"
            className="px-0"
            aria-expanded={showArchived}
            aria-controls="archived-list"
            onClick={() => setShowArchived((s) => !s)}
            id="archived-heading"
          >
            {showArchived ? "Hide" : "Show"} archived players ({archived.length})
          </Button>
          {showArchived && (
            <>
              <p className="mb-3 text-sm text-muted-foreground">
                Archived players don&apos;t appear in new lineups but stay in past briefings.
              </p>
              <ul id="archived-list" className="divide-y rounded-2xl border bg-card opacity-80" aria-label="Archived players">
                {archived.map((p) => (
                  <PlayerRow key={p.id} player={p} disabled={pending}>
                    <Button variant="ghost" size="sm" disabled={pending} onClick={() => toggleArchive(p, false)} aria-label={`Restore ${p.name}`}>
                      <ArchiveRestore aria-hidden /> <span className="hidden sm:inline">Restore</span>
                    </Button>
                  </PlayerRow>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {editing?.name}</DialogTitle>
          </DialogHeader>
          {editing && (
            <PlayerForm
              key={editing.id}
              idPrefix="edit"
              action={updatePlayer.bind(null, editing.id)}
              defaults={editing}
              submitLabel="Save player"
              pendingLabel="Saving…"
              onSuccess={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlayerRow({ player, children, disabled }: { player: Player; children: React.ReactNode; disabled?: boolean }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3" aria-busy={disabled || undefined}>
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold tabular-nums"
        aria-label={player.shirtNumber === null ? "No shirt number" : `Shirt number ${player.shirtNumber}`}
      >
        {player.shirtNumber ?? "–"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{player.name}</p>
        {player.preferredPositions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {player.preferredPositions.map((pos) => (
              <Badge key={pos} variant="secondary">
                {POSITION_LABELS[pos]}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <div className="flex shrink-0 gap-1">{children}</div>
    </li>
  );
}
