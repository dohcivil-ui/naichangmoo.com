"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState, useSyncExternalStore } from "react";
import { COOKIE_NOTICE_STORAGE_KEY, shouldShowNotice } from "@/lib/cookie-disclosure";
import { landingActionContract } from "@/lib/landing-interactions";

/**
 * A disclosure, not a consent prompt. There is no accept and no reject, because there is nothing to
 * decide: the only cookies this site sets are the ones that make signing in work, and they are set
 * whatever anyone clicks. A button that appears to grant permission for something that happens
 * anyway misstates the visitor's control, and it trains people to dismiss the real prompt — the one
 * that has to arrive before the first third-party embed (IP-111), where refusing genuinely has to
 * withhold a script.
 *
 * Closing this changes nothing about what the site does. It only stops the strip showing.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE STRIP NEVER CLOSES ITSELF. Only the visitor closes it, by pressing.
 * กฎจากเจ้าของผลิตภัณฑ์: แถบนี้ห้ามปิดตัวเองเด็ดขาด ต้องรอให้ผู้ใช้กดเท่านั้น
 *
 * No timeout, no auto-dismiss, no fade-out after N seconds. It is written here because it is
 * exactly the kind of thing a later change would add while believing it was an improvement. A
 * notice that disappears on a timer was not necessarily read, and it takes the decision to stop
 * showing it away from the person it is for. Changing this needs the owner's word, never a
 * judgement call.
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 */

/** Fired on the tab that wrote, because the `storage` event only reaches the *other* tabs. */
const NOTICE_CHANGED = "naichangmoo:cookie-notice-changed";

/**
 * Cannot collide with a stored value, which is always an ISO timestamp. Returned while rendering on
 * the server, where there is no way to know whether this visitor has already acknowledged — so the
 * strip is absent from the HTML and appears, if it should, once the browser can answer.
 */
const SERVER_SNAPSHOT = "__server__";
const UNREADABLE = "__unreadable__";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(NOTICE_CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(NOTICE_CHANGED, onChange);
  };
}

/** A string rather than an object: the snapshot is compared by identity on every render. */
function getSnapshot(): string {
  try {
    return window.localStorage.getItem(COOKIE_NOTICE_STORAGE_KEY) ?? "";
  } catch {
    // Private windows and blocked site data throw on access rather than returning null.
    return UNREADABLE;
  }
}

function getServerSnapshot(): string {
  return SERVER_SNAPSHOT;
}

export function CookieNotice() {
  /**
   * `useSyncExternalStore` rather than an effect that calls setState. localStorage is exactly what
   * it is for — an external store whose value the server cannot see — and it handles the two-pass
   * render properly: the server and the hydrating render use the server snapshot, so React never
   * reports a mismatch and nobody sees a strip flash at them after they put it away.
   */
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  /**
   * Only for the case where storage refuses the write: the visitor has closed the strip, the store
   * cannot record it, and it must still go away for this page view rather than sit there ignoring
   * them. Set from a click handler, which is where setState belongs.
   */
  const [dismissedHere, setDismissedHere] = useState(false);

  /**
   * The strip invites the reader to open the disclosure page. On the disclosure page that invitation
   * is noise, and worse, it covers the very table it is pointing at. Not acknowledged, just not
   * shown: a visitor who lands here first and never presses anything still meets it on the next page.
   */
  const onDisclosurePage = usePathname() === landingActionContract.cookiesHref;

  const acknowledge = useCallback(() => {
    setDismissedHere(true);
    try {
      // The time rather than a flag: same cost, and it records when this browser saw this version.
      // The key carries a version so a materially changed disclosure can be shown again.
      window.localStorage.setItem(COOKIE_NOTICE_STORAGE_KEY, new Date().toISOString());
      window.dispatchEvent(new Event(NOTICE_CHANGED));
    } catch {
      // Storage refused. `dismissedHere` closes it now and it returns on the next page, which is
      // the right way round: showing again is a nuisance, never showing is the failure.
    }
  }, []);

  const open =
    !dismissedHere &&
    !onDisclosurePage &&
    snapshot !== SERVER_SNAPSHOT &&
    shouldShowNotice(snapshot === UNREADABLE ? { readable: false } : { readable: true, value: snapshot || null });

  if (!open) return null;

  return (
    <aside className="cookie-notice" role="note" aria-label="ประกาศเรื่องคุกกี้">
      <div className="cookie-notice__card">
        <div className="cookie-notice__copy">
          <strong>เว็บไซต์นี้ใช้คุกกี้เฉพาะที่จำเป็นต่อการเข้าสู่ระบบ</strong>
          <p>
            เปิดดูเฉย ๆ โดยไม่เข้าสู่ระบบจะไม่มีคุกกี้ถูกตั้งเลย ไม่มีคุกกี้เพื่อการวิเคราะห์ โฆษณา หรือติดตามพฤติกรรม
            และไม่มีสคริปต์ของบุคคลที่สาม อ่าน<Link href={landingActionContract.cookiesHref}>{landingActionContract.cookiesLabel}</Link>เพื่อดูรายการทั้งหมด
          </p>
        </div>
        <button type="button" className="cookie-notice__ack" onClick={acknowledge}>รับทราบ</button>
        <button
          type="button"
          className="cookie-notice__close"
          onClick={acknowledge}
          aria-label="ปิดประกาศเรื่องคุกกี้"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>
    </aside>
  );
}
