import { describe, expect, it } from "vitest";
import {
  COOKIE_NOTICE_STORAGE_KEY,
  doesNotDo,
  notSetByThisSite,
  shouldShowNotice,
  storedItems
} from "@/lib/cookie-disclosure";

/**
 * IP-110. Two properties are worth holding here.
 *
 * The notice fails toward showing. A visitor who is told twice is mildly annoyed; a visitor who is
 * never told is the failure the notice exists to prevent, and the way that happens in practice is a
 * `localStorage` call throwing in a private window and the catch quietly deciding to stay silent.
 *
 * And the disclosure has to disclose itself. The entry the notice writes is the only client-side
 * storage this site has, and it would be absurd for the page about browser storage to omit the one
 * thing it causes.
 */

describe("whether the notice shows", () => {
  it("shows when nothing has been acknowledged", () => {
    expect(shouldShowNotice({ readable: true, value: null })).toBe(true);
  });

  it("stays closed once an acknowledgement is stored", () => {
    expect(shouldShowNotice({ readable: true, value: "2026-08-25T12:00:00.000Z" })).toBe(false);
  });

  it("shows when storage cannot be read at all, rather than assuming it was acknowledged", () => {
    // Safari private mode and blocked site data throw on access. Silence would be the wrong guess.
    expect(shouldShowNotice({ readable: false })).toBe(true);
  });

  it("treats an empty string as not acknowledged", () => {
    expect(shouldShowNotice({ readable: true, value: "" })).toBe(true);
  });

  it("carries a version in the storage key, so a changed disclosure can be shown again", () => {
    expect(COOKIE_NOTICE_STORAGE_KEY).toMatch(/\.v\d+$/);
  });
});

describe("the disclosure covers what the site actually stores", () => {
  it("lists the notice's own storage entry, since it is storage too", () => {
    const selfDisclosure = storedItems.find((item) => item.name === COOKIE_NOTICE_STORAGE_KEY);

    expect(selfDisclosure).toBeDefined();
    expect(selfDisclosure?.kind).toBe("local_storage");
  });

  it("names both cookies this configuration actually sets", () => {
    // Observed: better-auth.state on the response that begins a social sign-in, and
    // better-auth.session_token on the sign-out response that clears it.
    const cookies = storedItems.filter((item) => item.kind === "cookie").map((item) => item.name);

    expect(cookies).toEqual(["better-auth.state", "better-auth.session_token"]);
  });

  it("explains the names better-auth clears but never sets here, rather than leaving them a mystery", () => {
    const names = notSetByThisSite.map((item) => item.name);

    expect(names).toContain("better-auth.session_data");
    expect(names).toContain("better-auth.dont_remember");
    for (const item of notSetByThisSite) expect(item.why.length).toBeGreaterThan(20);
  });

  it("gives every listed item a purpose and a lifetime, because a name alone discloses nothing", () => {
    for (const item of storedItems) {
      expect(item.purpose.length).toBeGreaterThan(20);
      expect(item.lifetime.length).toBeGreaterThan(0);
      expect(item.setWhen.length).toBeGreaterThan(0);
    }
  });

  it("keeps every name unique, so the table cannot list one thing twice", () => {
    const names = storedItems.map((item) => item.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("states plainly that browsing without signing in sets nothing", () => {
    // Verified this session: `curl -D -` on / returns no Set-Cookie header at all.
    expect(doesNotDo.some((line) => line.includes("ไม่มีคุกกี้ถูกตั้งเลย"))).toBe(true);
  });
});
