"use client";

import { useActionState, useMemo } from "react";
import { Field, FormMessage } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { BoardSvg } from "@/components/board/board-svg";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { createTactic } from "@/app/(app)/app/tactics/actions";
import { boardFromFormation, type Formation } from "@/lib/domain/formations";
import { formatLabel } from "@/lib/domain/format";
import type { Team } from "@/lib/db/teams";
import { idle } from "@/lib/validation/form";
import { CATEGORY_LABELS, TACTIC_CATEGORIES } from "@/lib/validation/board";

export function NewTacticDialog({
  open,
  onOpenChange,
  team,
  formations,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  team: Team;
  formations: Formation[];
}) {
  const [state, action] = useActionState(createTactic.bind(null, team.id), idle);
  const fe = state.status === "error" ? state.fieldErrors : undefined;
  const v = state.status === "error" ? state.values : undefined;
  const starts = useMemo(
    () => [
      ...formations.map((f) => ({ id: f.id, name: f.name, board: boardFromFormation(f.format, f.id) })),
      { id: "blank", name: "Blank pitch", board: boardFromFormation(team.matchFormat, null) },
    ],
    [formations, team.matchFormat],
  );
  const chosen = typeof v?.start === "string" ? v.start : starts[0].id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New {formatLabel(team.matchFormat)} tactic</DialogTitle>
        </DialogHeader>
        <form action={action} className="grid gap-5" noValidate>
          <FormMessage state={state} />
          <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
            <Field label="Name" name="name" required maxLength={60} autoComplete="off" placeholder="e.g. Shape vs. Dynamos" defaultValue={typeof v?.name === "string" ? v.name : undefined} errors={fe?.name} />
            <div className="grid gap-1.5">
              <Label htmlFor="tactic-category">Type</Label>
              <select
                id="tactic-category"
                name="category"
                defaultValue={typeof v?.category === "string" ? v.category : "shape"}
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {TACTIC_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Start from</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {starts.map((s) => (
                <label
                  key={s.id}
                  className="flex cursor-pointer flex-col gap-1.5 rounded-xl border bg-background p-2 text-center text-sm transition-colors has-checked:border-primary has-checked:bg-accent has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
                >
                  <input type="radio" name="start" value={s.id} defaultChecked={chosen === s.id} className="sr-only" />
                  <BoardSvg board={s.board} teamColor={team.primaryColor} showLabels={false} className="rounded-md" decorative />
                  <span className="font-medium">{s.name}</span>
                </label>
              ))}
            </div>
            {fe?.start && <p className="mt-1 text-sm text-destructive">{fe.start[0]}</p>}
          </fieldset>
          <div>
            <SubmitButton pendingLabel="Creating…">Create and open editor</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
