"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  CONVERSION_NOTE_MAX,
  DIMENSION_LABELS,
  DIMENSION_RANK,
  LABEL_MAX,
  MAX_COUNT
} from "@/lib/takeoff-measurement";
import { findUnit } from "@/lib/takeoff-units";
import { addTakeoffMeasurement, type TakeoffActionState } from "@/server/actions/estimeter-takeoff";
import { Button } from "@/components/platform/button";

const initialState: TakeoffActionState = { ok: false, message: "" };

const dimensionFields = ["dimension1", "dimension2", "dimension3"] as const;

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button tone="quiet" type="submit" disabled={pending}>
      {pending ? "กำลังบันทึก..." : "เพิ่มรายการคำนวณ"}
    </Button>
  );
}

/**
 * One measured element: how many, and the lengths that were read off the drawing.
 *
 * The form shows exactly the number of length fields the item's unit implies, so a person
 * entering a cubic metre is asked for three and a person entering a running metre for one.
 * Showing three every time and hoping the right ones get filled is how a square metre ends up
 * multiplied by a thickness nobody meant to enter.
 */
export function AddMeasurementForm({ itemId, unitCode }: { itemId: string; unitCode: string }) {
  const [state, formAction] = useActionState(addTakeoffMeasurement, initialState);
  const errors = state.measurementErrors ?? {};

  const unit = findUnit(unitCode);
  if (!unit) return null;

  const rank = DIMENSION_RANK[unit.dimension];
  const labels = DIMENSION_LABELS[unit.dimension];
  const isMass = unit.dimension === "mass";

  return (
    <form className="quote-form measurement-form" action={formAction}>
      <input name="itemId" type="hidden" value={itemId} />

      <label className="measurement-form__label">
        ชิ้นงานที่วัด
        <input
          name="label"
          required
          maxLength={LABEL_MAX}
          autoComplete="off"
          placeholder="เช่น F1 ฐานรากมุมอาคาร"
          aria-invalid={errors.label ? true : undefined}
        />
      </label>

      <label>
        จำนวน
        <input
          name="count"
          required
          type="number"
          min={1}
          max={MAX_COUNT}
          step={1}
          defaultValue={1}
          autoComplete="off"
          aria-invalid={errors.count ? true : undefined}
        />
      </label>

      {Array.from({ length: rank }, (_, index) => {
        const field = dimensionFields[index]!;
        return (
          <label key={field}>
            {labels[index]}
            <input
              name={field}
              required
              inputMode="decimal"
              autoComplete="off"
              placeholder="เช่น 1.50"
              aria-invalid={errors[field] ? true : undefined}
            />
          </label>
        );
      })}

      {isMass ? (
        <>
          <label>
            {`น้ำหนักต่อเมตร (${unit.label}/ม.)`}
            <input
              name="conversionFactor"
              required
              inputMode="decimal"
              autoComplete="off"
              placeholder="เช่น 0.888"
              aria-invalid={errors.conversionFactor ? true : undefined}
            />
          </label>
          <label className="measurement-form__label">
            ที่มาของน้ำหนักต่อเมตร
            <input
              name="conversionNote"
              required
              maxLength={CONVERSION_NOTE_MAX}
              autoComplete="off"
              placeholder="เช่น DB12 = 0.888 กก./ม. ตารางน้ำหนักเหล็กเสริม"
              aria-invalid={errors.conversionNote ? true : undefined}
            />
          </label>
        </>
      ) : null}

      <div className="measurement-form__submit"><Submit /></div>

      {Object.values(errors).filter(Boolean).length > 0 ? (
        <ul className="form-error measurement-form__message" role="alert">
          {Object.values(errors)
            .filter(Boolean)
            .map((message) => (
              <li key={message}>{message}</li>
            ))}
        </ul>
      ) : state.message ? (
        <p className={state.ok ? "form-success measurement-form__message" : "form-error measurement-form__message"} role="status">
          {state.message}
        </p>
      ) : (
        <p className="form-note measurement-form__message">
          {isMass
            ? "หน่วยน้ำหนักวัดความยาวรวมแล้วคูณด้วยน้ำหนักต่อเมตร ตัวคูณต้องบอกที่มาได้"
            : `หน่วย ${unit.label} ต้องวัด ${rank === 0 ? "เฉพาะจำนวน" : `${rank} ระยะ`} ระบบคูณและรวมให้เอง`}
        </p>
      )}
    </form>
  );
}
