"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { requestEnterpriseQuotation, type QuotationActionResult } from "@/server/actions/enterprise-quotation";

const initialState: QuotationActionResult = { ok: false, message: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="button button--orange" type="submit" disabled={pending}>
      {pending ? "กำลังส่งคำขอ..." : "ส่งคำขอให้ทีมงานจัดทำข้อเสนอ"}
    </button>
  );
}

export function EnterpriseQuoteForm() {
  const [state, formAction] = useActionState(requestEnterpriseQuotation, initialState);

  return (
    <form className="quote-form" action={formAction}>
      <div className="honeypot" aria-hidden="true">
        <label>อย่ากรอกช่องนี้<input name="companyWebsite" type="text" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <div className="field-grid">
        <label>ชื่อองค์กรหรือหน่วยงาน<input name="organizationName" required autoComplete="organization" /></label>
        <label>ประเภทองค์กร<select name="organizationType" defaultValue=""><option value="" disabled>เลือกประเภท</option><option value="government">หน่วยงานภาครัฐ</option><option value="company">บริษัทเอกชน</option><option value="education">สถานศึกษา</option><option value="other">อื่น ๆ</option></select></label>
        <label>ชื่อผู้ติดต่อ<input name="contactName" required autoComplete="name" /></label>
        <label>อีเมลสำหรับติดต่อ<input name="contactEmail" type="email" required autoComplete="email" /></label>
        <label>โทรศัพท์ (ถ้ามี)<input name="contactPhone" inputMode="tel" autoComplete="tel" /></label>
        <label>จำนวนผู้ใช้โดยประมาณ<input name="teamSize" type="number" min="1" max="100000" /></label>
      </div>
      <fieldset>
        <legend>แอปที่สนใจ</legend>
        <div className="check-grid">
          <label><input name="intendedApps" value="estimeter" type="checkbox" /> ESTIMETR</label>
          <label><input name="intendedApps" value="rcopt" type="checkbox" /> RCOPT</label>
          <label><input name="intendedApps" value="traffic-sign" type="checkbox" /> Traffic Sign</label>
          <label><input name="intendedApps" value="land-acquisition" type="checkbox" /> Land Acquisition V2</label>
        </div>
      </fieldset>
      <label>ความต้องการหรือขั้นตอนจัดซื้อ<textarea name="requirementNote" required rows={4} placeholder="เช่น จำนวนผู้ใช้ รูปแบบการจัดซื้อ หรือวันที่ต้องการเริ่มใช้งาน" /></label>
      <label className="consent"><input name="consent" value="yes" required type="checkbox" /> ยินยอมให้ทีมงานติดต่อกลับตามข้อมูลข้างต้นเพื่อจัดทำข้อเสนอ</label>
      {state.message ? <p className={state.ok ? "form-success" : "form-error"} role="status" aria-live="polite">{state.message}</p> : null}
      <SubmitButton />
      <p className="form-note">การส่งแบบฟอร์มนี้ยังไม่ใช่ใบเสนอราคา การทำสัญญา หรือการชำระเงิน</p>
    </form>
  );
}
