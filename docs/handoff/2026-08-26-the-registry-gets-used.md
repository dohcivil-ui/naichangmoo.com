# Handoff — `App Registry — First Real Use, and Three Alarms That Were Not`

## Description

The registry ADR 0014 built had been through three versions without anyone opening its screen.
An administrator has now announced all five catalogue apps by hand, opened one, and withdrawn one,
and the public cards were measured saying exactly what the registry permitted and nothing more.
No source file changed to make that happen — the whole point of ADR 0014 is that it did not need to.

This session produced no product code. It produced evidence, one glossary sentence, and the removal
of an outage. It also ran head-first into what two sessions on one working tree costs, which is the
part worth reading before starting the next one.

## Changed Scope

| Area | Files | Summary |
|---|---|---|
| Glossary | `CONTEXT.md` | **เปิดใช้แล้ว (Open)** now states that the status rests on an announcement, and that a value left on an unannounced app is a trace of another path rather than a statement |
| Verification | `docs/verification/app-registry-announcement-2026-08-26.md` | The measured record: what was announced, what the cards said, six viewport widths, three alarms |
| Handoff | this file | — |

Commit `bfad92a`, pushed to `initial-project/nextjs-foundation`.

## What the registry now holds

Four of five apps announced, all as *กำลังเตรียมระบบ*, with eight `app.*` audit events carrying
actor, reason and a before/after pair each. **`estimeter` is announced no longer** — it was
announced, switched to open, re-saved with a written reason, then deliberately withdrawn to exercise
ADR 0014 §6. Its row survives with `announced_at` cleared, which is the behaviour the rule exists to
protect, and its card is correctly silent.

**The next person should re-announce `estimeter` as `paid_trial` + open.** It is one form and one
sentence, and until it happens the landing card understates a product that works.

## Verification

`npm test` 400 passed / 33 skipped · `npx tsc --noEmit` clean · `npm run lint` no output ·
`check-roadmap.mjs`, `check-release.mjs`, `security-check.mjs` all pass. Pre-commit ran the same
set again and passed.

Browser-measured on a wiped profile at **1440 · 761 · 721 · 640 · 390 · 360** — widths chosen to
straddle the stylesheet's own breakpoints, because it changes eight declarations at 720px and eight
more at 760px and that is where a regression hides. At every width: no horizontal overflow, all six
navigation destinations reachable, every card's call to action hit-tested with `elementFromPoint`
and returning itself. Claims read correctly at every width and the withdrawn card stayed silent.

## Three alarms, and what each actually was

Recorded because the cost of naming a bug before measuring it has now been paid four times here.

1. **A timestamp and an email looked joined** in the back office. Rebuilding the markup against the
   served stylesheet returned `display: block`, one client rect, the span 36px down a 64px cell.
   Nothing overrides the rule. Not a defect.
2. **The cookie notice would not appear.** `localStorage` held an acknowledgement from the previous
   afternoon. When that was cleared it vanished again, and an instrumented probe caught the write —
   the owner had pressed the button in the automation window, which sits visible on their desktop.
   Identical in cause to the alarm the previous session recorded. **Do not click in a browser an
   agent is driving.**
3. **Every route returned 500.** The served error named a drizzle-orm module that "was instantiated
   ... but the module factory is not available" — Turbopack's phrasing for a dev server holding
   modules a dependency change invalidated underneath it. Restarting the server and clearing
   `.next/dev` fixed it. No source file was at fault.

## What two sessions on one tree cost, concretely

Every item below was measured, not felt.

- The branch moved twice and the working tree's contents changed under the plan four times. Work
  now lands on **`initial-project/nextjs-foundation`**, not `feature/account-menu-and-app-identity`.
- The roadmap was rewritten from 51 items at v0.44.0 to **15 items at v0.47.0**. `IP-094`, `IP-114`,
  `IP-122` and `IP-125` no longer exist in it, and `IP-130`/`IP-131` were reissued meaning entirely
  different things. Any plan referring to the old numbers is stale.
- A commit was blocked mid-session by a half-typed `<aside>` in another session's file, because the
  pre-commit hook runs `lint`, `test` and `typecheck` over the whole tree rather than over what is
  staged.
- The shared dev server was unusable for a stretch through no fault of either session's code.

**The decision taken at the end of this session was to stop running two.** The next one should be
the only one.

## Tooling notes worth keeping

`chrome-devtools` MCP drives **Edge**, not Chrome, from `.cache/chrome-devtools-mcp/chrome-profile`,
and it dropped its connection on roughly every second call — each drop leaving the browser running
and the next call refusing with "already running". Killing only the processes whose command line
contains `chrome-devtools-mcp` recovers it without touching the owner's own 46 Edge processes.

After the third drop it was abandoned for a **28-line dependency-free CDP driver** using Node 24's
global `WebSocket`: `fetch /json/list`, open the page socket, `Emulation.setDeviceMetricsOverride`,
`Page.navigate`, `Runtime.evaluate`. It did not drop once. It lives in the session scratchpad and is
quicker to rewrite than to recover.

One measurement artefact to avoid repeating: `scrollIntoView` inherits `html { scroll-behavior:
smooth }`, so a hit-test taken 220ms later reads mid-animation coordinates and reports every button
unclickable. Pass `behavior: "instant"`.

## Security and data impact

None. No migration, no schema change, no permission change, no secret touched. The only writes were
registry announcements made by an authenticated administrator through the product's own form, each
with an audit event.

## Rollback

Revert `bfad92a`. It contains two documentation files and one sentence of glossary; nothing depends
on it. Registry state is separate from the code — to undo the announcements, withdraw each in the
back office, which clears `announced_at` without deleting rows (ADR 0014 §6).

## Next action

1. **Re-announce `estimeter`** as `paid_trial` + open. One form. Until then the card understates it.
2. **Finish the surfaces this session did not reach**: `/market/<slug>`, `/pricing`, and
   `/apps/<slug>` for an announced-but-not-open app, which should show the preparing page.
3. **The mobile navigation is dead code, measured.** `getComputedStyle` reports `flex-wrap: wrap` at
   every width and `overflow-x: auto` below 760px; both apply and the wrap wins, so the scroller has
   nothing to scroll. `.site-nav .nav-links` is 0-2-0 and the media block's `.nav-links` is 0-1-0 —
   a media query adds no specificity. Wrapping is the better behaviour anyway: the scrollbar is
   hidden, so a phone user who does not swipe would never learn three destinations exist. Delete the
   `overflow-x`, `overscroll-behavior-x`, `scrollbar-width` and `::-webkit-scrollbar` rules.
4. **The cookie strip was to be restyled** to a full-bleed bar on `--ink-deep` with white text,
   copy left and buttons right — the OpenAI *shape*, explicitly **not** its buttons. This site makes
   no third-party request at all, so a "reject non-essential" button would do nothing and an "accept
   all" would ask permission for what happens regardless. Consent buttons belong to IP-111, when a
   third-party embed first arrives. **The strip never closes itself. Only the visitor closes it.**
5. **The card answers "what does it cost" with a category, never an amount** — `doh_staff_only` says
   nothing about money and the VIP figures live only on `/pricing`. Worth a roadmap item under the
   new numbering.

## A standing requirement recorded this session

**The site must work on every device.** Verify UI work at 360 · 640 · 721 · 761 · 1024 · 1440,
straddling the stylesheet's real breakpoints rather than matching device sizes, and check
`scrollWidth <= clientWidth` at each.
