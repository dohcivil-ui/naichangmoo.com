"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { SignInButton } from "@/components/landing/sign-in-button";
import { authClient } from "@/lib/auth-client";
import {
  getAccountInteractionContract,
  type AccountAppAccess,
  type AccountViewer
} from "@/lib/landing-interactions";

/**
 * Initials with the provider's photo laid over them. The photo is a URL on Google's host that we
 * neither store nor serve: it can 404 when a member removes their picture, and it goes stale until
 * their next sign-in. So the initials are always rendered underneath, and a failed load simply
 * stops covering them rather than leaving a blank circle.
 */
function AccountAvatar({
  initials,
  url,
  size,
  className
}: {
  initials: string;
  url: string | null;
  size: number;
  className: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <span className={className} aria-hidden="true">
      {initials}
      {url && !failed ? (
        <Image src={url} alt="" width={size} height={size} onError={() => setFailed(true)} unoptimized={false} />
      ) : null}
    </span>
  );
}

/**
 * The account corner of the site header: a trigger showing who is signed in, and a card that opens
 * beneath it.
 *
 * A card rather than a list of links, because the useful thing to show a member here is where they
 * stand — which apps they hold, in what state, until when — and only then what they can do about
 * it. Signing out is last for the same reason it is last on a form: it ends the session, so it
 * should not sit where a mis-click lands.
 *
 * What to show is decided by `getAccountInteractionContract`, which is where that reasoning is
 * tested. This file is opening, closing and focus.
 */
export function AccountMenu({
  user,
  isPlatformAdmin = false,
  apps = []
}: {
  user: AccountViewer | null;
  isPlatformAdmin?: boolean;
  apps?: AccountAppAccess[];
}) {
  const router = useRouter();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Escape and a click elsewhere both close it. Both are bound only while it is open, so a page
  // with a closed menu carries no document-level listeners.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const contract = getAccountInteractionContract({ user, isPlatformAdmin, apps });
  if (contract.kind === "signed_out") return <SignInButton />;

  const signOut = async () => {
    setSigningOut(true);
    try {
      await authClient.signOut();
      setOpen(false);
      router.push(contract.afterSignOutHref);
      router.refresh();
    } catch {
      // The session outlived the attempt. Put the button back rather than leaving a member looking
      // at "กำลังออก…" with no way to try again.
      setSigningOut(false);
    }
  };

  return (
    <div className="account-menu" ref={rootRef}>
      <button
        className={`account-trigger${open ? " is-open" : ""}`}
        type="button"
        ref={triggerRef}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? contract.closeLabel : contract.openLabel}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        <AccountAvatar
          className="account-trigger__avatar"
          initials={contract.initials}
          url={contract.avatarUrl}
          size={30}
        />
        <span className="account-trigger__name">{contract.label}</span>
        <svg className="account-trigger__caret" viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
          <path
            d="M5 8l5 5 5-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <div className="account-panel" id={panelId}>
          <header className="account-panel__who">
            <AccountAvatar
              className="account-panel__avatar"
              initials={contract.initials}
              url={contract.avatarUrl}
              size={40}
            />
            <span className="account-panel__identity">
              <strong>{contract.label}</strong>
              <span>{contract.email}</span>
              <span className={`account-panel__role${contract.isPlatformAdmin ? " is-admin" : ""}`}>
                {contract.roleLabel}
              </span>
            </span>
          </header>

          <section className="account-panel__section">
            <p className="account-panel__heading">{contract.appsHeading}</p>
            {contract.apps.length === 0 ? (
              <p className="account-panel__empty">{contract.appsEmptyLabel}</p>
            ) : (
              <ul className="account-apps">
                {contract.apps.map((app) => (
                  <li key={app.slug}>
                    <Link className="account-app" href={app.href} onClick={() => setOpen(false)}>
                      <span className="account-app__name">{app.name}</span>
                      <span className={`account-app__state${app.expiringSoon ? " is-expiring" : ""}`}>
                        {app.stateLabel}
                      </span>
                      {app.note ? <span className="account-app__note">{app.note}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Link className="account-panel__link" href={contract.accountHref} onClick={() => setOpen(false)}>
            {contract.accountLabel}
            <span aria-hidden="true">→</span>
          </Link>

          {contract.adminHref ? (
            <Link className="account-panel__link" href={contract.adminHref} onClick={() => setOpen(false)}>
              {contract.adminLabel}
              <span aria-hidden="true">→</span>
            </Link>
          ) : null}

          <button className="account-panel__signout" type="button" onClick={signOut} disabled={signingOut}>
            {signingOut ? contract.signingOutLabel : contract.signOutLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
