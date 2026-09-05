"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, type Tone } from "@/components/platform/button";
import type { TakeoffActionState } from "@/server/actions/estimeter-takeoff";

const initialState: TakeoffActionState = { ok: false, message: "" };

type Action = (state: TakeoffActionState | undefined, formData: FormData) => Promise<TakeoffActionState>;

function Submit({
  label,
  pendingLabel,
  tone,
  disabled
}: {
  label: string;
  pendingLabel: string;
  tone: Tone;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button tone={tone} type="submit" disabled={disabled} pending={pending} pendingLabel={pendingLabel}>
      {label}
    </Button>
  );
}

/**
 * A single-purpose form for one take-off state change. `disabledReason` is presentation only:
 * the same rule is enforced in the action, so a direct POST cannot skip it.
 */
export function TakeoffActionButton({
  action,
  fields,
  label,
  pendingLabel,
  tone = "quiet",
  disabledReason
}: {
  action: Action;
  fields: Record<string, string>;
  label: string;
  pendingLabel: string;
  tone?: Tone;
  disabledReason?: string | null;
}) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="takeoff-action">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} name={name} type="hidden" value={value} />
      ))}
      <Submit
        label={label}
        pendingLabel={pendingLabel}
        tone={tone}
        disabled={Boolean(disabledReason)}
      />
      {disabledReason ? <span className="takeoff-action__reason">{disabledReason}</span> : null}
      {state.message ? (
        <span className={state.ok ? "takeoff-action__ok" : "takeoff-action__error"} role="status">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
