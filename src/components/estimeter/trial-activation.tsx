"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ESTIMETR_TRIAL_DAYS, ESTIMETR_TRIAL_LIMITS } from "@/lib/estimeter-trial";
import { startEstimeterTrial, type TrialActivationState } from "@/server/actions/estimeter-trial";

const initialState: TrialActivationState = { ok: false, message: "" };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="button button--orange" type="submit" disabled={pending}>
      {pending ? "กำลังเปิดสิทธิ์..." : "เริ่มทดลองใช้"}
    </button>
  );
}

/**
 * The terms sit next to the control, because pressing it starts a clock that cannot be reset.
 * A member who reads this screen and closes it has spent none of the seven days.
 *
 * The project cap is listed here on purpose. ADR 0009 removed it from the copy that runs before
 * entry, where a limit is the wrong first thing to say about a tool, but this screen is where the
 * member agrees to the terms. Dropping it here too would mean agreeing to a wall nobody mentioned.
 */
export function TrialActivation() {
  const [state, formAction] = useActionState(startEstimeterTrial, initialState);

  const terms = [
    `ใช้งานได้ ${ESTIMETR_TRIAL_DAYS} วัน นับจากเวลาที่กดเริ่ม`,
    `สร้างได้ ${ESTIMETR_TRIAL_LIMITS.projectLimit} โครงการ`,
    "ส่งออกไฟล์และพิมพ์เอกสารถูกล็อกไว้ตลอดช่วงทดลองใช้",
    "เมื่อครบกำหนด ข้อมูลเดิมยังเปิดดูได้ แต่สร้างและแก้ไขไม่ได้"
  ];

  return (
    <section className="trial-activation" aria-label="เริ่มทดลองใช้ ESTIMETR">
      <div>
        <p className="eyebrow">สิทธิ์ทดลองใช้ ESTIMETR</p>
        <h2>บัญชีนี้ยังไม่ได้เริ่มทดลองใช้</h2>
        <p>
          การเป็นสมาชิกนายช่างหมูไม่ทำให้นาฬิกาทดลองใช้เดิน สิทธิ์ {ESTIMETR_TRIAL_DAYS} วันจะเริ่มนับเมื่อคุณกดเริ่มเท่านั้น
          จึงเปิดดูหน้านี้ไว้ก่อนได้โดยไม่เสียวัน
        </p>
        <ul className="trial-activation__terms">
          {terms.map((term) => (
            <li key={term}>{term}</li>
          ))}
        </ul>
      </div>
      <form className="trial-activation__action" action={formAction}>
        <Submit />
        <p className="form-note">การกดปุ่มนี้คือการยอมรับเงื่อนไขข้างต้น และระบบจะบันทึกไว้ในร่องรอยการตรวจ</p>
        {state.message ? (
          <p className={state.ok ? "form-success" : "form-error"} role="status">{state.message}</p>
        ) : null}
      </form>
    </section>
  );
}
