"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { getLoginInteractionContract } from "@/lib/landing-interactions";

export function SignInButton({ callbackURL, className }: { callbackURL?: string; className?: string } = {}) {
  const [notice, setNotice] = useState("");
  const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true";
  const contract = getLoginInteractionContract(authEnabled, callbackURL);
  const buttonClass = className ?? "button button--primary";

  if (contract.kind === "preview_notice") {
    return (
      <div className="sign-in-preview">
        <button className={buttonClass} type="button" onClick={() => setNotice(contract.notice)}>{contract.label}</button>
        {notice ? <span role="status">{notice}</span> : null}
      </div>
    );
  }

  return (
    <button className={buttonClass} type="button" onClick={() => authClient.signIn.social({ provider: contract.provider, callbackURL: contract.callbackURL })}>
      {contract.label}
    </button>
  );
}
