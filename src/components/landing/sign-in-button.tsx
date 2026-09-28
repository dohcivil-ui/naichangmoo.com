"use client";

import { useState } from "react";
import { Button, type Size, type Tone } from "@/components/platform/button";
import { authClient } from "@/lib/auth-client";
import { getLoginInteractionContract } from "@/lib/landing-interactions";

/**
 * `label` เปลี่ยนได้เฉพาะคำบนปุ่ม ไม่เปลี่ยนสิ่งที่ปุ่มทำ
 *
 * เว็บนี้เข้าระบบด้วย Google อย่างเดียว การสมัครสมาชิกกับการเข้าสู่ระบบจึงเป็นการกดปุ่มเดียวกัน
 * แถบบนของหน้าร้านมีสองช่อง "เข้าสู่ระบบ" กับ "สมัครสมาชิก" ตามผืนออกแบบ ทั้งคู่จึงต้องเป็น
 * ปุ่มตัวนี้ แต่พูดคนละคำ · ค่าตั้งต้นยังเป็นคำจากสัญญาเหมือนเดิม คนเรียกเดิมไม่กระทบสักจุด
 *
 * **คำที่ส่งเข้ามาต้องมาจากผืนออกแบบหรือ `docs/rules/copy-th.md` เท่านั้น ห้ามแต่งเอง**
 * และห้ามใช้ช่องนี้พูดสิ่งที่ปุ่มทำไม่ได้ — มันพาไปหน้า Google เสมอ ไม่ว่าจะเขียนว่าอะไร
 */
export function SignInButton({
  callbackURL,
  tone = "ink",
  size,
  label
}: { callbackURL?: string; tone?: Tone; size?: Size; label?: string } = {}) {
  const [notice, setNotice] = useState("");
  const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true";
  const contract = getLoginInteractionContract(authEnabled, callbackURL);

  if (contract.kind === "preview_notice") {
    return (
      <div className="sign-in-preview">
        <Button tone={tone} size={size} onClick={() => setNotice(contract.notice)}>{label ?? contract.label}</Button>
        {notice ? <span role="status">{notice}</span> : null}
      </div>
    );
  }

  return (
    <Button tone={tone} size={size} onClick={() => authClient.signIn.social({ provider: contract.provider, callbackURL: contract.callbackURL })}>
      {label ?? contract.label}
    </Button>
  );
}
