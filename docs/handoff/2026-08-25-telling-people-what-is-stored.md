# Handoff — `v0.43.0: Telling People What Is Stored, Instead of Asking a Question With One Answer`

## Description

The owner asked for a cookie notice. Four questions were put about its shape and all four were
answered with the recommended option: **disclose rather than ask for consent**, **site-wide rather
than landing-only**, **remembered once dismissed**, and **a cookie page first** with the full privacy
policy left until the owner's legal-entity questions are settled.

## The facts the disclosure rests on, all observed this session

Not taken from better-auth's documentation, and not from the earlier handoff's summary table.

| what | how it was checked | result |
|---|---|---|
| the landing page sets nothing | `curl -D -` on `/` | **no `Set-Cookie` header at all** |
| the OAuth state cookie | the real response that begins a social sign-in | `better-auth.state` · `Max-Age=300` · `HttpOnly` · `SameSite=Lax` · `Path=/` |
| the session cookie's name | the `Set-Cookie` on sign-out that clears it | `better-auth.session_token` |
| the session's lifetime | `SELECT expires_at - created_at FROM sessions` | **7 days** |
| two names that are cleared but never set | better-auth's own source | `session_data` needs `cookieCache` (not configured); `dont_remember` needs a "don't remember me" option (does not exist here) |
| the `__Secure-` prefix | `node_modules/better-auth/dist/cookies/index.mjs:23` | applied over HTTPS, so live names differ from local ones |
| no analytics, pixels or tag managers | grep across `src/` | none |
| no third-party request from the browser | [next.config.ts](next.config.ts) proxies avatars; `next/font` self-hosts | none |

## Why there is no accept button

Every cookie here is required for signing in and gets set whatever anyone clicks. A button that
appears to grant permission for something that happens anyway misstates the visitor's control and
produces consent records that record nothing — and worse, it teaches people to dismiss the prompt
that will matter, the one that must arrive before the first LINE/Facebook/TikTok/Instagram/YouTube
embed (**IP-111**) where refusing genuinely has to withhold a script.

The owner sent DBD-Registered's banner as a reference. Its **layout** was adopted; its copy was not.
That banner says cookies are used *"เพื่อพัฒนาประสิทธิภาพการให้บริการและปรับปรุงคุณภาพของเว็บไซต์"* —
an analytics purpose, which is why a consent button is right for them. Copying the sentence would
have meant claiming a purpose this site does not have.

## Changed Scope

| Area | Files | Summary |
|---|---|---|
| Disclosure data | `src/lib/cookie-disclosure.ts` (new) | The table as data plus `shouldShowNotice`, so the page and the tests read one source |
| Notice | `src/components/platform/cookie-notice.tsx` (new), `src/app/layout.tsx` | Client component mounted once in `RootLayout` |
| Page | `src/app/cookies/page.tsx` (new) | The table, what the site does not do, and why there is no accept button |
| Links | `platform-footer.tsx`, `account-menu.tsx`, `landing-interactions.ts` | Footer and the signed-in account menu, both from the contract |
| Styling | `src/app/globals.css` | `.cookie-notice` and the policy page |

## How the remembering works

`CookieNotice` reads storage through **`useSyncExternalStore`**, not through an effect that calls
`setState`. The first attempt did use an effect, and `react-hooks/set-state-in-effect` was right to
reject it: `localStorage` is precisely the "external store the server cannot see" that
`useSyncExternalStore` exists for, and it handles the two-pass render properly. The server snapshot
is a sentinel that can never collide with a stored ISO timestamp, so the strip is absent from the
server HTML and from the hydrating render — React reports no mismatch, and nobody sees a strip flash
at them after they put it away.

Two things came free with the correct API. A `storage` listener means acknowledging in one tab hides
it in the others; a custom event covers the writing tab, which `storage` deliberately skips. The one
piece of local state left is `dismissedHere`, set from the click handler — where `setState` belongs —
so that a visitor whose storage refuses the write still gets the strip out of their way.

The key `naichangmoo.cookie-notice.v1` **carries a version**, so a materially changed disclosure can
be shown again by bumping it. The value is the acknowledgement timestamp rather than a flag — same
cost, more information. Both read and write are wrapped in `try/catch`, and **a throw shows the
notice**: being told twice is a nuisance, never being told is the failure.

This entry is the only client-side storage the site has, and the notice about browser storage is
what creates it — so the page lists it beside the two cookies.

## It never closes itself — a standing instruction

**Only the visitor closes the strip, by pressing.** No timeout, no auto-dismiss, no fade after N
seconds. This is the owner's explicit instruction and it is repeated in the component itself,
because it is exactly the kind of thing a later change adds while believing it is an improvement. A
notice that disappears on a timer was not necessarily read, and it takes the decision away from the
person the notice is for.

The strip also behaves identically on every page, which was measured rather than argued: on `/` and
on `/pricing` the card occupies **706–815px in an 831px viewport**, is not covered at its centre by
anything, and stays exactly there while the page is scrolled to the bottom. Seeing it on `/pricing`
but not on `/` was simply a matter of which tab was being looked at while it was still
unacknowledged — acknowledging it removes it everywhere at once, and clearing the key brings it back
everywhere at once.

## Not shown on the disclosure page itself

The strip invites the reader to open `/cookies`. On `/cookies` that invitation is noise, and it
covered the very table it was pointing at. It is now suppressed there — **not acknowledged, just not
shown**, so a visitor who lands on the disclosure first and presses nothing still meets the strip on
their next page. Verified: on `/cookies` with storage empty the strip is absent, and on `/pricing`
immediately afterwards, with storage still empty, it returns.

## A wrong turn worth recording

Twice during this work something was called a bug before it had been measured properly.

First the notice appeared to acknowledge itself on mount: the key was cleared, the page reloaded,
and a fresh timestamp appeared with the strip gone. Not a bug — the owner was watching the same
browser and clicking `รับทราบ`. Patching `localStorage.setItem` through an init script, installed
**before any page script ran**, showed `writeCount: 0` with the strip present.

Then, checking in Edge over the DevTools protocol, `/` reported `notice: false` with nothing stored,
and that was announced as the real bug. It was not one either: the probe had waited 1.5s after
`Page.navigate` and could attach to whichever tab matched first. Waiting properly and pinning the
target gave `notice: true`, then `0` writes while idle and exactly `1` on click.

The lesson is about method, not code: **instrument, wait for the state to settle, and pin what you
are measuring — before saying the word "bug" out loud.** Both false alarms cost more than the one
real defect found in the same period.

## Verification

- `pnpm test` — 296 pass. New: the show/hide decision with storage empty, acknowledged, empty-string
  and **unreadable** (must show); the key is versioned; the table lists its own storage entry, names
  exactly the two cookies observed, and gives every row a purpose and a lifetime.
- Instrumented in the browser: `writeCount: 0` on mount; the acknowledgement survives reloads and
  route changes; clearing site data brings the notice back; the button computes to `rgb(13,130,130)`.
- `npx tsc --noEmit` clean; `check-roadmap.mjs` and `security:check` pass.

## Not built, and why

The owner's reference account menu carries **three** entries — terms of use, privacy policy, sign
out. This platform has only the cookie disclosure, so only that was linked.

- **Privacy policy — IP-110.** Needs a legal entity name, address and contact channel. Those are
  facts only the owner holds, and the entity question is open (**IP-126**, **IP-127**).
- **Terms of use — IP-129, new.** Nothing on the roadmap covered it.

A menu entry pointing at a page that does not exist is the same failure as a trustmark nobody
granted, so neither was linked ahead of being written.

## Security and data impact

None on the server. No migration, no schema change, no write path. The only new storage is one
`localStorage` entry in the visitor's own browser that never reaches us.

## Rollback

Revert the commit. Visitors keep a stale `naichangmoo.cookie-notice.v1` entry, which is inert.

## Next action

1. **Three versions are now complete, verified and uncommitted** — `v0.41.0`, `v0.42.0`, `v0.43.0`.
   The tree also holds another session's in-progress move of brand images from an API route to
   `public/` (`M src/lib/visual-assets.ts`, `D src/app/api/visual-assets/[key]/route.ts`, `?? public/`,
   `M .env.example`, `M next-env.d.ts`). **`git commit -a` would sweep that in.**
2. **Announce the five apps** in the back office — still outstanding, still a human act under ADR 0014.
3. **IP-114** — `/account` while signed in, press sign-out-other-devices, and check the new cookie
   link in the account menu, which could not be seen without a session.
4. **IP-129 / IP-110** — terms of use and the privacy policy.
