"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Field, FormMessage } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { idle, type ActionState } from "@/lib/validation/form";
import { POSITIONS, POSITION_LABELS, type Position } from "@/lib/validation/player";

type Defaults = { name?: string; shirtNumber?: number | null; preferredPositions?: Position[] };

export function PlayerForm({
  action,
  defaults = {},
  submitLabel,
  pendingLabel,
  idPrefix,
  resetOnSuccess = false,
  onSuccess,
  footer,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  defaults?: Defaults;
  submitLabel: string;
  pendingLabel: string;
  idPrefix: string;
  resetOnSuccess?: boolean;
  onSuccess?: () => void;
  footer?: React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, idle);
  const formRef = useRef<HTMLFormElement>(null);
  const fe = state.status === "error" ? state.fieldErrors : undefined;
  const v = state.status === "error" ? state.values : undefined;
  const positions = (Array.isArray(v?.preferredPositions) ? v.preferredPositions : defaults.preferredPositions) ?? [];

  useEffect(() => {
    if (state.status !== "success") return;
    if (state.message) toast.success(state.message);
    if (resetOnSuccess) {
      formRef.current?.reset();
      formRef.current?.querySelector<HTMLInputElement>("input[name=name]")?.focus();
    }
    onSuccess?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-4" noValidate>
      {state.status === "error" && <FormMessage state={state} />}
      <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
        <Field
          id={`${idPrefix}-name`}
          label="Name"
          name="name"
          required
          maxLength={60}
          autoComplete="off"
          defaultValue={typeof v?.name === "string" ? v.name : defaults.name}
          errors={fe?.name}
        />
        <Field
          id={`${idPrefix}-number`}
          label="Shirt no."
          name="shirtNumber"
          inputMode="numeric"
          placeholder="—"
          maxLength={2}
          defaultValue={typeof v?.shirtNumber === "string" ? v.shirtNumber : (defaults.shirtNumber ?? undefined)}
          errors={fe?.shirtNumber}
        />
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Preferred positions</legend>
        <div className="flex flex-wrap gap-2">
          {POSITIONS.map((p) => (
            <label
              key={p}
              className="cursor-pointer rounded-full border bg-background px-3 py-1 text-sm transition-colors has-checked:border-primary has-checked:bg-accent has-checked:text-accent-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
            >
              <input type="checkbox" name="preferredPositions" value={p} defaultChecked={positions.includes(p)} className="sr-only" />
              {POSITION_LABELS[p]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton pendingLabel={pendingLabel}>{submitLabel}</SubmitButton>
        {footer}
      </div>
    </form>
  );
}
