# Handoff — `v0.49.0: One Size on the Paper, the Size the Regulation Names`

## Description

The annex a contractor files with a government contract declared 16pt at the top of the sheet and
then shrank six rules underneath it, so a single page carried six type sizes and nine of its
fourteen elements were smaller than the regulation allows. It now carries three sizes, none below
16pt, and a layout borrowed from the government report it will be filed next to. The same session
also put the app registry through its first real use by a person, and spent a good deal of its time
discovering what two sessions on one working tree costs.

## Changed Scope

| Area | Files | Summary |
|---|---|---|
| Printed annex | `src/components/prototype/work-plan-document.tsx` | Centred masthead, four numbered sections, facts table, amount-in-words under the figure it spells, ruled note frame, signature blocks with a date line |
| Paper typography | `src/app/globals.css` | Three sizes declared in points — 20 / 18 / 16 — replacing six that came from `em` nested in `em`; two dead rule sets removed |
| Glossary | `CONTEXT.md` | **เปิดใช้แล้ว (Open)** now says the status rests on an announcement |
| Verification | `docs/verification/app-registry-announcement-2026-08-26.md` | The registry's first real use, measured |
| Roadmap | `roadmap.v0.49.0.json` · `roadmap.json` · `CHANGELOG.md` · `package.json` | v0.49.0, four new items IP-145 … IP-148 |

Commits `bfad92a`, `9e7f882`, `9e63437`, and this one.

## Verification

`pnpm test` 400 passed / 33 skipped · `pnpm typecheck` clean · `pnpm lint` no output ·
`check-roadmap.mjs` and `check-release.mjs` aligned at 0.49.0.

Typography measured through CDP against the **real document inside the running app**, not a
replica: three sizes (20 / 18 / 16pt), 48 text-bearing elements, none below 16pt, hierarchy carried
by weight — 15 elements at 16pt/700 and 28 at 16pt/400. Before the change the same measurement
returned six sizes and nine of fourteen elements under 16pt.

Registry verified in a browser at **1440 · 761 · 721 · 640 · 390 · 360**, widths chosen to straddle
the stylesheet's own breakpoints rather than to match devices. At every width: no horizontal
overflow, all six navigation destinations reachable, every card's call to action confirmed with
`elementFromPoint`.

## What the registry holds right now

Four of five apps announced, all as *กำลังเตรียมระบบ*, with eight audit events carrying actor,
reason and a before/after pair each. **`estimeter` is not announced** — it was announced, opened,
re-saved, then deliberately withdrawn to exercise ADR 0014 §6, and its row survived with
`announced_at` cleared. Re-announcing it is IP-147 and takes one form.

## Three alarms, none of which were defects

The measurement that settled each is recorded, because naming a bug before measuring it has now
cost this repository four times.

1. **A timestamp and an email looked joined** in the back office. Rebuilt against the served
   stylesheet: `display: block` applied, one client rect, the span 36px down a 64px cell.
2. **The cookie notice would not appear.** `localStorage` held an acknowledgement. Cleared, it
   vanished again — an instrumented probe caught the write, and the owner had pressed the button in
   the browser an agent was driving. **Do not click in an automation window.**
3. **The app lost its layout.** A `setDeviceMetricsOverride` left behind by the measuring tool. It
   does not clear across CDP connections; closing the browser is what removes it. Prefer
   `--window-size` and never leave an override set.

A fourth failure was real but not in any source file: every route returned 500 because the dev
server held modules a dependency change had invalidated underneath it. Restarting it and clearing
`.next/dev` fixed it.

## Tooling notes worth keeping

`chrome-devtools` MCP drives **Edge**, not Chrome, from `.cache/chrome-devtools-mcp/chrome-profile`,
and dropped its connection on roughly every second call. Killing only processes whose command line
contains `chrome-devtools-mcp` recovers it without touching the owner's own Edge.

It was abandoned for a small dependency-free CDP driver on Node 24's global `WebSocket` —
`fetch /json/list`, open the page socket, `Page.navigate`, `Runtime.evaluate`. It did not drop once.
Two lessons are already paid for: give every CDP call its own timeout, or one unanswered request
hangs the run; and `scrollIntoView` inherits `html { scroll-behavior: smooth }`, so a hit-test taken
220ms later reads mid-animation coordinates and reports every button unclickable — pass
`behavior: "instant"`.

## Security and data impact

None. No migration, no schema change, no permission change, no secret touched. The only data writes
were registry announcements made by an authenticated administrator through the product's own form.

## Rollback

`git checkout v0.48.0-preview-page-at-size-it`. Everything above it is layout, typography and
documentation. Registry state lives in the database, not the code — to undo the announcements,
withdraw each in the back office, which clears `announced_at` without deleting rows (ADR 0014 §6).

## Next action

Four items are queued, in this order. Each is already decided; none of them needs a fresh design
discussion.

1. **IP-145 — the cookie strip.** Restyle to a full-bleed bar at the bottom edge on `--ink-deep`
   with white text, copy left and buttons right. **Keep both existing buttons and add no consent
   buttons.** This site makes no third-party request at all, so "reject non-essential" would do
   nothing and "accept all" would ask permission for what happens regardless. Real consent buttons
   are IP-111, when a third-party embed first arrives. **The strip never closes itself.**
2. **IP-146 — the mobile navigation.** `flex-wrap: wrap` at 0-2-0 beats the media block's
   `overflow-x: auto` at 0-1-0 at every width, measured. Wrapping is the wanted behaviour; delete
   the four dead scroller rules.
3. **IP-147 — re-announce `estimeter`** as `paid_trial` + open, then check `/market/<slug>`,
   `/pricing`, and `/apps/<slug>` for an announced-but-not-open app.
4. **IP-148 — what the card says about price.** A category, never an amount.

## One instruction that outranks the queue

**Run one session at a time.** This one lost more hours to concurrency than to any bug in the
product: the branch moved twice, the roadmap was rewritten from fifty-one items to fifteen and lost
the numbers the session's plan was built on, a commit was blocked by a half-typed JSX tag in another
session's file because the pre-commit hook lints the whole tree, and the shared dev server was
unusable for a stretch. Everything above was measured, not felt.

## Standing rules this session had to learn twice

- **The site must work on every device.** Verify at 360 · 640 · 721 · 761 · 1024 · 1440, straddling
  the real breakpoints, and check `scrollWidth <= clientWidth` at each.
- **No emoji anywhere** — UI, documents, commit messages, and replies to the owner alike.
- **Colours come from the theme only.** The palette has three real tones; separate things with line
  style, weight and spacing instead of adding a fourth.
