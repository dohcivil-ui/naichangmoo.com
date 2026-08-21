"use client";

import { authClient } from "@/lib/auth-client";

export function SignInButton() {
  return (
    <button className="button button--primary" onClick={() => authClient.signIn.social({ provider: "google", callbackURL: "/apps/estimeter" })}>
      เข้าสู่ระบบด้วย Google
    </button>
  );
}
