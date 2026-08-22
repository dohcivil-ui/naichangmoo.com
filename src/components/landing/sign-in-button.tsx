"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function SignInButton() {
  const [notice, setNotice] = useState("");
  const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true";

  if (!authEnabled) {
    return (
      <div className="sign-in-preview">
        <button className="button button--primary" type="button" onClick={() => setNotice("Preview นี้ยังไม่เปิด Google Login จนกว่าจะตั้งค่า PostgreSQL และ OAuth credentials")}>ดูสถานะ Google Login</button>
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
