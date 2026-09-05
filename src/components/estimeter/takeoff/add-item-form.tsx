"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { DESCRIPTION_MAX } from "@/lib/takeoff-item";
import { TAKEOFF_CATEGORIES, TAKEOFF_UNITS } from "@/lib/takeoff-units";
import { addTakeoffItem, type TakeoffActionState } from "@/server/actions/estimeter-takeoff";
import { Button } from "@/components/platform/button";

const initialState: TakeoffActionState = { ok: false, message: "" };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button tone="primary" type="submit" disabled={pending}>
      {pending ? "กำลังบันทึก..." : "เพิ่มรายการ"}
    </Button>
  );
}

/**
 * Built for someone entering lines all day: the field order matches the order a person reads
 * a drawing, every field is reachable by keyboard, and the form keeps its category and unit
 * choice after a submit so a run of similar lines does not need re-selecting.
 *
 * There is no quantity field. Since v0.17.0 the quantity is the total of the item's measurement
 * lines, so this form names the item and the next step measures it.
 */
export function AddItemForm({ runId }: { runId: string }) {
  const [state, formAction] = useActionState(addTakeoffItem, initialState);
  const errors = state.itemErrors ?? {};

  return (
    <form className="quote-form takeoff-form" action={formAction}>
      <input name="runId" type="hidden" value={runId} />

      <label>
        หมวดงาน
        <select name="category" defaultValue="structure" aria-invalid={errors.category ? true : undefined}>
          {TAKEOFF_CATEGORIES.map((category) => (
            <option key={category.code} value={category.code}>{category.label}</option>
          ))}
        </select>
      </label>

      <label className="takeoff-form__wide">
        รายละเอียดรายการ
        <input
          name="description"
          required
          maxLength={DESCRIPTION_MAX}
          autoComplete="off"
          placeholder="เช่น คอนกรีตโครงสร้างคาน B1 ชั้น 2"
          aria-invalid={errors.description ? true : undefined}
        />
      </label>

      <label>
        หน่วย
        <select name="unit" defaultValue="cu_m" aria-invalid={errors.unit ? true : undefined}>
          {TAKEOFF_UNITS.map((unit) => (
            <option key={unit.code} value={unit.code}>{unit.label}</option>
          ))}
        </select>
      </label>

      <div className="takeoff-form__submit"><Submit /></div>

      {Object.values(errors).filter(Boolean).length > 0 ? (
        <ul className="form-error takeoff-form__errors" role="alert">
          {errors.category ? <li>{errors.category}</li> : null}
          {errors.description ? <li>{errors.description}</li> : null}
          {errors.unit ? <li>{errors.unit}</li> : null}
        </ul>
      ) : state.message ? (
        <p className={state.ok ? "form-success takeoff-form__errors" : "form-error takeoff-form__errors"} role="status">
          {state.message}
        </p>
      ) : (
        <p className="form-note takeoff-form__errors">
          หน่วยที่เลือกกำหนดว่าต้องวัดกี่ระยะ ปริมาณไม่ต้องกรอกเอง ระบบรวมให้จากรายการคำนวณที่บันทึกในขั้นถัดไป
        </p>
      )}
    </form>
  );
}
