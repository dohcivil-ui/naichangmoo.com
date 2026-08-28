"use client";

import { useActionState } from "react";
import { saveChannel, type ChannelFormState } from "@/server/actions/admin-channels";
import type { AdminChannel } from "@/server/platform-channels";

const initial: ChannelFormState = { ok: true, message: "" };

/**
 * ฟอร์มหนึ่งช่องทาง: กรอกค่า + เหตุผล แล้วบันทึก หรือกดล้างค่าเพื่อซ่อนช่องนั้นจากท้ายเว็บ
 * เหตุผลบังคับทั้งสองทาง ตามกติกาหลังบ้านเดิม — การแก้ที่ไม่ต้องอธิบายคือการแก้ที่ตรวจย้อนไม่ได้
 */
export function ChannelForm({ channel }: { channel: AdminChannel }) {
  const [state, formAction, pending] = useActionState(saveChannel, initial);

  return (
    <form action={formAction} className="admin-form" style={{ padding: 0 }}>
      <input type="hidden" name="key" value={channel.key} />
      <label>
        <span>ค่าของช่องทาง</span>
        <input type="text" name="value" defaultValue={channel.value ?? ""} placeholder={channel.hint} />
      </label>
      <label>
        <span>เหตุผลของการแก้ครั้งนี้</span>
        <input type="text" name="reason" placeholder="เช่น เปิดบัญชี LINE OA แล้ว" required minLength={4} />
      </label>
      <div className="admin-form__foot">
        <button className="button button--orange micro-button" type="submit" name="intent" value="save" disabled={pending}>
          บันทึกและแสดงบนท้ายเว็บ
        </button>
        <button className="button button--ghost micro-button" type="submit" name="intent" value="clear" disabled={pending}>
          ล้างค่าและซ่อนจากท้ายเว็บ
        </button>
      </div>
      {state.message ? (
        <p className={state.ok ? "admin-form__ok" : "admin-form__error"} role="status">{state.message}</p>
      ) : null}
    </form>
  );
}
