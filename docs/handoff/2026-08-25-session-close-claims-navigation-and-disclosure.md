# Handoff — `v0.44.0: Session Close — Claims, Navigation and Disclosure`

## Description

One session, three versions, one theme that only became visible while working: **a page may
introduce something freely, but the moment it makes a claim, someone has to have made that claim.**
It started as a question about app cards and ended up governing badges, trustmarks and cookies.

Read the three version notes for detail. This one exists so a fresh session can start without
joining them together.

| version | note | what |
|---|---|---|
| `v0.41.0` | [a-card-introduces-an-app…](2026-08-25-a-card-introduces-an-app-the-registry-makes-the-claims.md) | ADR 0015; card badges, dates and CTA wording come from the registry |
| `v0.42.0` | [one-way-home…](2026-08-25-one-way-home-called-the-same-thing-everywhere.md) | ADR 0016; a labelled `หน้าแรก`, one word per destination, the trust module |
| `v0.43.0` | [telling-people-what-is-stored](2026-08-25-telling-people-what-is-stored.md) | the cookie notice and `/cookies` |

## The through-line

ADR 0014 said an app is free because an administrator said so. Three things turned out to be the
same shape, and each got the same treatment:

- **A card's access badge** — the registry says it, or the card says nothing (ADR 0015).
- **A trustmark in the footer** — the issuer granted it, or nothing renders (ADR 0016).
- **A cookie notice** — informs, because there is nothing to consent to; a consent button for
  something that happens anyway is a claim about the visitor's control that isn't true.

The pattern is worth carrying into whatever comes next: **find the authority before drawing the
thing that claims it.**

## What was found along the way

- The landing page had been publishing **"ฟรี ทดลองใช้งาน 7 วัน"** for five apps that no
  administrator has ever announced. ADR 0014 named this gap itself as IP-092 and it had never been
  done.
- The registry **has no price column**; all money is platform-wide in `pricing.ts`. "Put the price
  on the card" could only ever mean an access category.
- `AppShell` was a **fourth** source-derived claim, on every page of every app, missed because ADR
  0014's closing note listed only two surfaces.
- Every page already had a way home — **the logo** — but nothing on screen said so, and one
  destination had collected **five different names**.
- `/roadmap` was the only page with **no header at all**, and it is linked from every footer.
- `CONTEXT.md` still said the trial was **5 days**; the code and ADR 0009 say 7.
- The site makes **no third-party request from the visitor's browser at all** — avatars proxied,
  fonts self-hosted, no analytics anywhere.

## Environment as left

- Dev server was running on `localhost:3000`. Postgres migrated, seed fixtures loaded.
- **The `apps` table still holds one row and `announced_at` is still null.** Nothing is announced,
  so every card is in its silent state. This is correct, not broken.
- `chrome-devtools` MCP is **wedged** — it holds its own Chrome profile and refuses to start a
  second instance. Close that Chrome before using it again. Edge was driven over CDP instead
  (`--remote-debugging-port=9222`); the probe script lives in the session scratchpad and is easy to
  rewrite: `fetch /json/list`, connect the page's WebSocket, `Runtime.evaluate`.
- Two Edge windows may still be open, one on a throwaway profile in `%TEMP%\edge-cdp-probe`.

## Verification at close

`npx tsc --noEmit` clean · `npm run lint` **no output at all** · **297 tests pass** ·
`check-roadmap.mjs` and `security:check` pass.

Browser-verified: cards silent before any announcement; the missing `gap` restored; `หน้าแรก` lights
correctly; six nav pills fit at 1440px and wrap without loss at 390px; `/roadmap` has header and
footer; no trust row renders; the cookie notice shows, remembers, returns when cleared, and is
absent on `/cookies` only.

## Two false alarms, recorded on purpose

Something was called a bug twice before it had been measured properly — once when the notice
appeared to acknowledge itself (the owner was clicking it in a shared browser), once when a CDP
probe reported it missing on `/` (the probe read too early and could attach to the wrong tab). Both
cost more than the one real defect found in the same period.

**Instrument, let the state settle, and pin what is being measured — before saying "bug".** And
checking that an element is *in the DOM* is not checking that it is *visible and clickable*; use
`getBoundingClientRect` against the viewport and `elementFromPoint`.

## Standing instruction

**The cookie notice never closes itself.** Only the visitor closes it — no timeout, no auto-dismiss.
This is recorded in `cookie-notice.tsx` with a Thai line beside the English, because it is the kind
of rule a later change removes while believing it is an improvement. Changing it needs the owner's
word.

## Concurrent work on this branch — read before assuming

Another session worked on `feature/account-menu-and-app-identity` at the same time and has committed
`9c3c135`, `45ff449`, `15c2bfd`, `3228bf1` — brand images moved off a CDN, `STATIC_ASSET_ORIGIN`
dropped, an esbuild pin, icon prompts. Their in-flight work is **still in the tree** and is
deliberately **not** in this session's commit: `package.json` / `pnpm-lock.yaml`
(`@napi-rs/canvas`), `scripts/render-pdf-pages.mjs`, `docs/research/*`, and
`.design/escalation-k` / `.design/ip-090`. `next-env.d.ts` is regenerated by Next and was left alone.

**Check `git status` and `git log` before believing anything about this branch's state.**

## Next action

1. **Announce the five apps in the back office** as the granted administrator — a human act under
   ADR 0014, which is why no script does it. `rcopt` and `traffic-sign` are `member_free` and must be
   announced with **open = false**; `announceApp` refuses otherwise. This is also **IP-094**, the
   browser verification the registry has never had, and it is what makes the cards speak.
2. **IP-114** — `/account` while signed in: press sign-out-other-devices, confirm the Google avatar
   loads, and check the new cookie link in the account menu, which could not be seen without a session.
3. **IP-122** — the entry panel on `/market/estimeter` reads *ยังไม่เปิดให้เข้าใช้* directly above
   *ทดลองใช้งานฟรี 7 วัน*, because the heading comes from the registry and the sentence is still
   governed by ADR 0010. Narrowing it is an amendment, not an edit.
4. **IP-129 / IP-110** — terms of use and the privacy policy. Both need the owner's legal entity
   facts, which are open (**IP-126**, **IP-127**).
5. **IP-125** — the mobile nav's horizontal scroller has never worked: a media-query rule at
   specificity 0-1-0 loses to `.site-nav .nav-links` at 0-2-0. Decide whether wrapping is wanted and
   delete the dead rule, or raise its specificity.
6. **IP-113** — the two displaced back-office tests.

## Security and data impact

None across all three versions. No migration, no schema change, no server-side write path. The
changes can only make the product claim **less** than it did before.

## Rollback

Revert this session's commit. Visitors keep an inert `naichangmoo.cookie-notice.v1` entry in their
own browser. If any app has been announced in the meantime, revoke it in the back office as well,
which clears `announced_at` without deleting the row (ADR 0014 §6).
