"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { GROUP_TITLE_MAX, type OutlineNode } from "@/lib/takeoff-outline";
import {
  addTakeoffGroup,
  setTakeoffItemGroup,
  type TakeoffActionState
} from "@/server/actions/estimeter-takeoff";
import { Button } from "@/components/platform/button";

const initialState: TakeoffActionState = { ok: false, message: "" };

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button tone="quiet" type="submit" disabled={pending}>
      {pending ? "กำลังบันทึก..." : label}
    </Button>
  );
}

/**
 * Adds a หมวดงาน heading, optionally inside an existing one.
 *
 * Only top-level headings are offered as parents, because the sheet numbers two levels and no
 * more. The ลำดับที่ is never asked for: it follows from where the heading sits.
 */
export function AddGroupForm({ runId, parents }: { runId: string; parents: readonly OutlineNode[] }) {
  const [state, formAction] = useActionState(addTakeoffGroup, initialState);

  return (
    <form className="quote-form evidence-form" action={formAction}>
      <input name="runId" type="hidden" value={runId} />

      <label className="evidence-form__note">
        ชื่อหมวดงาน
        <input
          name="title"
          required
          maxLength={GROUP_TITLE_MAX}
          autoComplete="off"
          placeholder="เช่น งานโครงสร้าง คอนกรีตเสริมเหล็ก"
        />
      </label>

      <label>
        อยู่ใต้หมวด
        <select name="parentId" defaultValue="">
          <option value="">ไม่มี (เป็นหมวดหลัก)</option>
          {parents.map((parent) => (
            <option key={parent.id} value={parent.id}>{`${parent.number} ${parent.title}`}</option>
          ))}
        </select>
      </label>

      <div className="evidence-form__submit"><Submit label="เพิ่มหมวดงาน" /></div>

      {state.message ? (
        <p className={state.ok ? "form-success evidence-form__message" : "form-error evidence-form__message"} role="status">
          {state.message}
        </p>
      ) : (
        <p className="form-note evidence-form__message">
          ลำดับที่ไล่ให้เองตามตำแหน่ง ลบหมวดกลางแล้วเลขที่เหลือขยับตามทันที ไม่มีเลขค้างให้ต้องแก้
        </p>
      )}
    </form>
  );
}

/** Files one line under a heading. Submitting an empty value takes it back out. */
export function ItemGroupSelect({
  itemId,
  groupId,
  options
}: {
  itemId: string;
  groupId: string | null;
  options: readonly OutlineNode[];
}) {
  const [state, formAction] = useActionState(setTakeoffItemGroup, initialState);

  return (
    <form className="takeoff-action" action={formAction}>
      <input name="itemId" type="hidden" value={itemId} />
      <label>
        <span className="form-note">หมวดงาน</span>
        <select name="groupId" defaultValue={groupId ?? ""}>
          <option value="">ยังไม่จัดหมวด</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>{`${option.number} ${option.title}`}</option>
          ))}
        </select>
      </label>
      <Submit label="ย้ายหมวด" />
      {state.message ? (
        <span className={state.ok ? "takeoff-action__ok" : "takeoff-action__error"} role="status">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
