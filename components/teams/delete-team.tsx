"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FormMessage } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { idle, type ActionState } from "@/lib/validation/form";

export function DeleteTeam({
  teamName,
  playerCount,
  action,
}: {
  teamName: string;
  playerCount: number;
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(action, idle);
  const fe = state.status === "error" ? state.fieldErrors : undefined;

  return (
    <section aria-labelledby="danger-heading" className="rounded-2xl border border-destructive/30 bg-card p-5">
      <h2 id="danger-heading" className="font-semibold">Delete team</h2>
      <p className="mt-1 text-sm text-muted-foreground">Permanently removes the team and everything in it.</p>
      <Button variant="destructive" className="mt-4 w-full" onClick={() => setOpen(true)}>
        Delete team…
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {teamName}?</DialogTitle>
            <DialogDescription>
              This permanently deletes the team, its {playerCount} player record{playerCount === 1 ? "" : "s"}, and
              all of its tactics, matches and plans. Any shared briefing links will stop working. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <form action={formAction} className="grid gap-4">
            <FormMessage state={state} />
            <Field label={`Type “${teamName}” to confirm`} name="confirmName" autoComplete="off" errors={fe?.confirmName} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <SubmitButton variant="destructive" pendingLabel="Deleting…">
                Delete team permanently
              </SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
