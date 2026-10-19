"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Field, FormMessage } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { MATCH_FORMATS, formatLabel, type MatchFormat } from "@/lib/domain/format";
import { idle, type ActionState } from "@/lib/validation/form";
import { TEAM_COLORS } from "@/lib/validation/team";
import { cn } from "@/lib/utils";
import { TEAM_COLOR_NAMES } from "./team-colors";

const FORMAT_HINT: Record<MatchFormat, string> = {
  5: "Small-sided, futsal, cage football",
  7: "Youth and seven-a-side leagues",
  11: "Full pitch, Sunday league",
};

type Defaults = { name?: string; matchFormat?: MatchFormat; primaryColor?: string };

export function TeamForm({
  action,
  defaults = {},
  submitLabel,
  pendingLabel,
  formatWarning,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  defaults?: Defaults;
  submitLabel: string;
  pendingLabel: string;
  formatWarning?: string;
}) {
  const [state, formAction] = useActionState(action, idle);
  const fe = state.status === "error" ? state.fieldErrors : undefined;
  const values = state.status === "error" ? state.values : undefined;
  const name = typeof values?.name === "string" ? values.name : defaults.name;
  const format = Number(values?.matchFormat ?? defaults.matchFormat ?? 7);
  const color = (typeof values?.primaryColor === "string" ? values.primaryColor : defaults.primaryColor) ?? TEAM_COLORS[0];

  useEffect(() => {
    if (state.status === "success" && state.message) toast.success(state.message);
  }, [state]);

  return (
    <form action={formAction} className="grid max-w-xl gap-6" noValidate>
      {state.status === "error" && <FormMessage state={state} />}
      <Field label="Team name" name="name" required minLength={2} maxLength={60} defaultValue={name} errors={fe?.name} autoComplete="off" />

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Match format</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {MATCH_FORMATS.map((f) => (
            <label
              key={f}
              className="relative flex cursor-pointer flex-col rounded-xl border bg-background p-3 transition-colors has-checked:border-primary has-checked:bg-accent has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
            >
              <input type="radio" name="matchFormat" value={f} defaultChecked={format === f} className="sr-only" />
              <span className="font-semibold">{formatLabel(f)}</span>
              <span className="text-xs text-muted-foreground">{FORMAT_HINT[f]}</span>
            </label>
          ))}
        </div>
        {formatWarning && <p className="text-xs text-muted-foreground">{formatWarning}</p>}
        {fe?.matchFormat && <p className="text-sm text-destructive">{fe.matchFormat[0]}</p>}
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Team colour</legend>
        <div className="flex flex-wrap gap-2">
          {TEAM_COLORS.map((c) => (
            <label
              key={c}
              title={TEAM_COLOR_NAMES[c]}
              className="flex cursor-pointer items-center gap-2 rounded-full border bg-background py-1 pr-3 pl-1 text-sm transition-colors has-checked:border-foreground has-checked:font-medium has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
            >
              <input type="radio" name="primaryColor" value={c} defaultChecked={color === c} className="sr-only" />
              <span aria-hidden className={cn("size-6 rounded-full ring-1 ring-black/10")} style={{ backgroundColor: c }} />
              {TEAM_COLOR_NAMES[c]}
            </label>
          ))}
        </div>
        {fe?.primaryColor && <p className="text-sm text-destructive">{fe.primaryColor[0]}</p>}
      </fieldset>

      <div>
        <SubmitButton pendingLabel={pendingLabel} size="lg">
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}
