"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { MAX_WASTE_PERCENT, WASTE_SOURCE_MAX } from "@/lib/takeoff-measurement";
import { setTakeoffWaste, type TakeoffActionState } from "@/server/actions/estimeter-takeoff";

const initialState: TakeoffActionState = { ok: false, message: "" };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="button button--ghost micro-button" type="submit" disabled={pending}>
      {pending ? "กำลังบันทึก..." : "บันทึกค่าเผื่อ"}
    </button>
  );
}

/**
 * The material allowance and the rule it is claimed from, kept next to each other.
 *
 * An allowance folded silently into a measured quantity is indistinguishable from a measuring
 * error, so the source field is required whenever the percentage is not zero.
 */
export function WasteForm({
  itemId,
  percent,
  sourceNote
}: {
  itemId: string;
  percent: string;
  sourceNote: string | null;
}) {
  const [state, formAction] = useActionState(setTakeoffWaste, initialState);
  const errors = state.wasteErrors ?? {};

  return (
    <form className="quote-form waste-form" action={formAction}>
      <input name="itemId" type="hidden" value={itemId} />

      <label>
        ค่าเผื่อ (%)
        <input
          name="wastePercent"
          inputMode="decimal"
          autoComplete="off"
          defaultValue={percent}
          placeholder="เช่น 7"
          aria-invalid={errors.wastePercent ? true : undefined}
        />
      </label>

      <label className="waste-form__source">
        ที่มาของค่าเผื่อ
        <input
          name="wasteSourceNote"
          maxLength={WASTE_SOURCE_MAX}
          autoComplete="off"
          defaultValue={sourceNote ?? ""}
          placeholder="เช่น หลักเกณฑ์การเผื่อวัสดุมวลรวม งานเหล็กเสริม 7%"
          aria-invalid={errors.wasteSourceNote ? true : undefined}
        />
      </label>

      <div className="waste-form__submit"><Submit /></div>

      {errors.wastePercent || errors.wasteSourceNote ? (
        <p className="form-error waste-form__message" role="alert">
          {errors.wastePercent ?? errors.wasteSourceNote}
        </p>
      ) : state.message ? (
        <p className={state.ok ? "form-success waste-form__message" : "form-error waste-form__message"} role="status">
          {state.message}
        </p>
      ) : (
        <p className="form-note waste-form__message">
          ค่าเผื่อไม่เกิน {MAX_WASTE_PERCENT}% และต้องบอกที่มาได้ ปล่อยเป็น 0 ถ้ายังไม่เผื่อ
        </p>
      )}
    </form>
  );
}
