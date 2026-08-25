"use client";

import { useActionState } from "react";
import { signOutOtherDevices, type AccountActionState } from "@/server/actions/account";

const initial: AccountActionState = { ok: false, message: "" };

/**
 * Ends every other session. The button is plain rather than alarming: it is a safety action a
 * member should feel free to use, not a destructive one they need warning about — this device stays
 * signed in, and the others simply have to sign in again.
 */
export function SignOutOtherDevices({ otherSessionCount }: { otherSessionCount: number }) {
  const [state, formAction, pending] = useActionState(async () => await signOutOtherDevices(), initial);

  return (
    <form action={formAction} className="account-page__action">
      <button className="button button--ghost" type="submit" disabled={pending || otherSessionCount === 0}>
        {pending ? "กำลังดำเนินการ…" : "ออกจากระบบอุปกรณ์อื่นทั้งหมด"}
      </button>
      {otherSessionCount === 0 ? (
        <p className="account-page__hint">อุปกรณ์นี้เป็นที่เดียวที่เข้าระบบอยู่</p>
      ) : (
        <p className="account-page__hint">จะปิด {otherSessionCount.toLocaleString("th-TH")} อุปกรณ์อื่น อุปกรณ์นี้ยังเข้าอยู่</p>
      )}
      {state.message ? (
        <p className={state.ok ? "account-page__ok" : "account-page__error"} role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
