"use client";

import { useState } from "react";
import { Button, type Tone } from "@/components/platform/button";
import { authClient } from "@/lib/auth-client";
import { getLoginInteractionContract } from "@/lib/landing-interactions";

export function SignInButton({ callbackURL, tone = "ink" }: { callbackURL?: string; tone?: Tone } = {}) {
  const [notice, setNotice] = useState("");
  const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true";
  const contract = getLoginInteractionContract(authEnabled, callbackURL);

  if (contract.kind === "preview_notice") {
    return (
      <div className="sign-in-preview">
        <Button tone={tone} onClick={() => setNotice(contract.notice)}>{contract.label}</Button>
        {notice ? <span role="status">{notice}</span> : null}
      </div>
    );
  }

  return (
    <Button tone={tone} onClick={() => authClient.signIn.social({ provider: contract.provider, callbackURL: contract.callbackURL })}>
      {contract.label}
    </Button>
  );
}
