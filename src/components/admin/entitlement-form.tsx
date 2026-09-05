"use client";

import { useActionState } from "react";
import { changeEntitlement, type EntitlementFormState } from "@/server/actions/admin-entitlement";
import { entitlementStateLabel } from "@/lib/platform-admin-labels";
import type { AdminSettableState, CustomerEntitlement } from "@/server/admin/entitlement-admin";
import { ThaiDateField } from "@/components/ui/thai-date-field";
import { Button } from "@/components/platform/button";

const initial: EntitlementFormState = { ok: false, message: "" };

/**
 * One row of the entitlement editor. The reason field is required in the markup and again on the
 * server, because a browser is not where a rule lives — the client requirement only saves the
 * administrator a round trip.
 */
export function EntitlementForm({
  entitlement,
  organizationId,
  states
}: {
  entitlement: CustomerEntitlement;
  organizationId: string;
  states: readonly AdminSettableState[];
}) {
  const [state, formAction, pending] = useActionState(changeEntitlement, initial);
  const endsAtValue = entitlement.endsAt ? entitlement.endsAt.toISOString().slice(0, 10) : "";

  return (
    <form className="admin-form" action={formAction}>
      <input type="hidden" name="entitlementId" value={entitlement.entitlementId} />
      <input type="hidden" name="organizationId" value={organizationId} />

      <div className="admin-form__row">
        <label>
          <span>สถานะสิทธิ์</span>
          <select name="state" defaultValue={entitlement.state}>
            {states.map((option) => (
              <option key={option} value={option}>
                {entitlementStateLabel[option] ?? option}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>วันหมดอายุ</span>
          {/* โหมด uncontrolled: input hidden ชื่อ endsAt ส่งค่า ISO ให้ FormData ค่าว่าง = ไม่มีกำหนด */}
          <ThaiDateField name="endsAt" defaultValue={endsAtValue} ariaLabel="วันหมดอายุ" />
          <small>เว้นว่างหมายถึงไม่มีกำหนดสิ้นสุด</small>
        </label>
      </div>

      <label>
        <span>เหตุผล ระบุทุกครั้ง</span>
        <input
          type="text"
          name="reason"
          required
          minLength={4}
          placeholder="เช่น ต่ออายุให้ 7 วันเพราะระบบล่มระหว่างทดลองใช้"
        />
        <small>บันทึกลงประวัติพร้อมชื่อผู้ดำเนินการ สถานะก่อนแก้ และสถานะหลังแก้</small>
      </label>

      <div className="admin-form__foot">
        <Button tone="primary" type="submit" disabled={pending}>
          {pending ? "กำลังบันทึก…" : "บันทึกการเปลี่ยนแปลง"}
        </Button>
        {state.message ? (
          <p className={state.ok ? "admin-form__ok" : "admin-form__error"} role="status">
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
