"use client";

import { useActionState, useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Field, FormMessage } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { idle, type ActionState } from "@/lib/validation/form";

const subscribe = () => () => {};
const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

type Defaults = { opponentName?: string; date?: string; time?: string; venue?: string | null; timeZone?: string };

/** Fixture form (MATCH-01). New fixtures use the browser's zone; edits keep the fixture's own. */
export function MatchForm({
  action,
  defaults = {},
  submitLabel,
  pendingLabel,
  onSuccess,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  defaults?: Defaults;
  submitLabel: string;
  pendingLabel: string;
  onSuccess?: () => void;
}) {
  const [state, formAction] = useActionState(action, idle);
  const zone = useSyncExternalStore(subscribe, browserZone, () => "UTC");
  const timeZone = defaults.timeZone ?? zone;
  const fe = state.status === "error" ? state.fieldErrors : undefined;
  const v = state.status === "error" ? state.values : undefined;
  const str = (k: string, d?: string | null) => (typeof v?.[k] === "string" ? (v[k] as string) : (d ?? undefined));

  useEffect(() => {
    if (state.status === "success") {
      if (state.message) toast.success(state.message);
      onSuccess?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      {state.status === "error" && <FormMessage state={state} />}
      <input type="hidden" name="timeZone" value={timeZone} />
      <Field label="Opponent" name="opponentName" required maxLength={60} autoComplete="off" placeholder="e.g. Dynamos" defaultValue={str("opponentName", defaults.opponentName)} errors={fe?.opponentName} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" name="date" type="date" required defaultValue={str("date", defaults.date)} errors={fe?.date} />
        <Field label="Kickoff" name="time" type="time" required defaultValue={str("time", defaults.time)} errors={fe?.time} />
      </div>
      <p className="-mt-2 text-xs text-muted-foreground" suppressHydrationWarning>
        Times are in {timeZone.replace(/_/g, " ")}.
      </p>
      <Field label="Venue (optional)" name="venue" maxLength={120} autoComplete="off" placeholder="e.g. Riverside Park, pitch 3" defaultValue={str("venue", defaults.venue)} errors={fe?.venue} />
      <div>
        <SubmitButton pendingLabel={pendingLabel}>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
