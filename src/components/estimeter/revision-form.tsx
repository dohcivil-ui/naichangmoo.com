"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  COSTING_METHOD_LABEL,
  costingMethodDenial,
  type CostingMethod,
  type PriceAuthoritySource
} from "@/lib/price-authority";
import { issueEstimateRevision, type RevisionActionState } from "@/server/actions/estimeter-revision";

const initialState: RevisionActionState = { ok: false, message: "" };

const METHODS: CostingMethod[] = ["factor_f", "contractor_cost"];

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="button button--orange micro-button" type="submit" disabled={pending || disabled}>
      {pending ? "กำลังออกประมาณราคา..." : "ออกประมาณราคาจากบัญชีนี้"}
    </button>
  );
}

/**
 * ออกฉบับคำนวณจากชุดราคาหนึ่งชุด (IP-216)
 *
 * ชุดเดียวออกได้ทั้งสองวิธี เพราะเคสที่ ADR 0008 ยกมาเป็นเหตุผลหลักคือผู้รับเหมาเอกชนที่ต้องรู้
 * สองเลขบนปริมาณชุดเดียวกัน คือราคากลางที่เป็นเพดาน กับต้นทุนและกำไรของตัวเอง ฟอร์มนี้จึง
 * ไม่หายไปหลังออกฉบับแรก
 *
 * เหตุผลที่ Factor F ถูกปิดแสดงตรงนี้เพื่อให้คนเข้าใจ **แต่ด่านจริงอยู่ที่ repository**
 * ปุ่มที่ถูก disabled กันได้แค่คนที่กดผ่านหน้าจอ ไม่ได้กันคนที่ POST ตรง
 */
export function RevisionForm({
  projectId,
  priceSetId,
  authority,
  canEdit,
  lockReason
}: {
  projectId: string;
  priceSetId: string;
  authority: PriceAuthoritySource;
  canEdit: boolean;
  lockReason: string | null;
}) {
  const [state, formAction] = useActionState(issueEstimateRevision, initialState);
  const [method, setMethod] = useState<CostingMethod>(
    costingMethodDenial("factor_f", authority) ? "contractor_cost" : "factor_f"
  );

  const denial = costingMethodDenial(method, authority);
  const blocked = !canEdit || Boolean(denial);

  return (
    <form action={formAction} className="quote-form revision-issue">
      <input name="projectId" type="hidden" value={projectId} />
      <input name="priceSetId" type="hidden" value={priceSetId} />

      <label>
        วิธีคิดราคาของครั้งนี้
        <select
          name="costingMethod"
          value={method}
          onChange={(event) => setMethod(event.target.value as CostingMethod)}
          disabled={!canEdit}
        >
          {METHODS.map((option) => (
            <option key={option} value={option}>
              {COSTING_METHOD_LABEL[option]}
            </option>
          ))}
        </select>
      </label>

      <div className="revision-issue__submit">
        <Submit disabled={blocked} />
      </div>

      <p className="revision-issue__note">
        {canEdit
          ? (denial ?? "เลขครั้งนับแยกตามวิธีคิด ประมาณราคาที่ออกแล้วแก้ไม่ได้ ต้องการตัวเลขชุดใหม่ให้ออกครั้งถัดไป")
          : (lockReason ?? "สิทธิ์ปัจจุบันเปิดดูโครงการนี้ได้ แต่ออกประมาณราคาไม่ได้")}
      </p>

      {state.message ? (
        <p className={state.ok ? "revision-issue__ok" : "revision-issue__error"} role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
