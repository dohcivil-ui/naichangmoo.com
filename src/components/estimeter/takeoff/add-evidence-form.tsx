"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { EVIDENCE_NOTE_MAX, MAX_PAGE_NUMBER } from "@/lib/takeoff-item";
import { addTakeoffEvidence, type TakeoffActionState } from "@/server/actions/estimeter-takeoff";

const initialState: TakeoffActionState = { ok: false, message: "" };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="button button--ghost micro-button" type="submit" disabled={pending}>
      {pending ? "กำลังบันทึก..." : "บันทึกหลักฐาน"}
    </button>
  );
}

export function AddEvidenceForm({ itemId }: { itemId: string }) {
  const [state, formAction] = useActionState(addTakeoffEvidence, initialState);
  const errors = state.evidenceErrors ?? {};

  return (
    <form className="quote-form evidence-form" action={formAction}>
      <input name="itemId" type="hidden" value={itemId} />

      <label className="evidence-form__note">
        ที่มาของปริมาณ
        <input
          name="note"
          required
          maxLength={EVIDENCE_NOTE_MAX}
          autoComplete="off"
          placeholder="เช่น แบบ S-05 คาน B1 ช่วง A-B วัดจากตารางคาน"
          aria-invalid={errors.note ? true : undefined}
        />
      </label>

      <label>
        หน้าที่อ้างอิง
        <input
          name="pageNumber"
          type="number"
          min={1}
          max={MAX_PAGE_NUMBER}
          autoComplete="off"
          placeholder="ไม่ระบุก็ได้"
          aria-invalid={errors.pageNumber ? true : undefined}
        />
      </label>

      <div className="evidence-form__submit"><Submit /></div>

      {errors.note || errors.pageNumber ? (
        <p className="form-error evidence-form__message" role="alert">{errors.note ?? errors.pageNumber}</p>
      ) : state.message ? (
        <p className={state.ok ? "form-success evidence-form__message" : "form-error evidence-form__message"} role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
