"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function SignInButton() {
  const [notice, setNotice] = useState("");
  const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true";

  if (!authEnabled) {
    return (
      <div className="sign-in-preview">
        <button className="button button--primary" type="button" onClick={() => setNotice("กำลังเตรียมระบบเข้าสู่ระบบ")}>เข้าสู่ระบบ</button>
        {notice ? <span role="status">{notice}</span> : null}
      </div>
    );
  }

  return (
    <button className="button button--primary" type="button" onClick={() => authClient.signIn.social({ provider: "google", callbackURL: "/apps/estimeter" })}>
      เข้าสู่ระบบด้วย Google
    </button>
  );
}
