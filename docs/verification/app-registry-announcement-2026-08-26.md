# App Registry Announcement — Browser Verification — 2026-08-26

The registry ADR 0014 introduced had shipped across three versions without a single screen ever
being looked at. This records the first time a person used it, and what the public pages did as a
result. Every figure below was read out of the running product or the database, never from an
earlier note.

## What an administrator did

`doh.civil@gmail.com` announced all five catalogue apps through `/admin/apps`, then exercised the
two paths the registry had never been taken down. Eight `app.*` audit events exist, each carrying
an actor, a reason and a before/after pair.

| time | event | app | recorded transition |
|---|---|---|---|
| 17:23:45 | announced | `estimeter` | `{open: true, announced: false}` → `{open: false, announced: true}` |
| 17:23:56 | announced | `rcopt` | → `member_free`, not open |
| 17:24:07 | announced | `traffic-sign` | → `member_free`, not open |
| 17:24:09 | announced | `land-acquisition` | → `doh_staff_only`, not open |
| 17:24:14 | announced | `escalation-k` | → `paid_trial`, not open |
| 17:24:55 | announced | `estimeter` | → `{open: true}` |
| 17:25:36 | announced | `estimeter` | re-saved with a written reason |
| 17:25:43 | **revoked** | `estimeter` | → `{announced: false, open: false}`, row retained |

The revocation is the important one. ADR 0014 §6 forbids deleting the row because
`app_entitlements.app_id` cascades; the recorded transition shows `announced_at` cleared with the
row still present, which is what the rule asks for.

## What the first announcement proves about a stale value

The opening event's `before` is `{open: true, announced: false}` — a row `activateEstimeterTrial()`
had inserted when the first customer started a trial, carrying an openness nobody had announced.
ADR 0014 predicted this row in its alternatives table. Nothing in the product acted on it:
`readAppOpenState` tests the announcement first and returns `unknown`, and `readCatalogueClaims`
skips unannounced rows. It is a value with no reader, not a defect.

The glossary, however, defined **เปิดใช้แล้ว (Open)** as a state an announced app has, and said
nothing about a value sitting on an app nobody had announced. `CONTEXT.md` now says so explicitly.

## What the cards said afterwards

Measured on the landing page with the registry holding four announcements and `estimeter` revoked.
Every element was checked for a non-zero rect inside the viewport and confirmed with
`document.elementFromPoint` at its centre, not merely found in the DOM.

| card | readiness | access | announced-on | call to action | CTA hit-tested |
|---|---|---|---|---|---|
| `estimeter` (revoked) | — | — | — | ดูรายละเอียดแอป | clickable |
| `escalation-k` | กำลังเตรียมระบบ | ฟรี ทดลองใช้งาน 7 วัน | ประกาศเมื่อ 26 ส.ค. 2569 | ดูรายละเอียดแอป | clickable |
| `rcopt` | กำลังเตรียมระบบ | สมาชิกใช้ฟรี | ประกาศเมื่อ 26 ส.ค. 2569 | ดูรายละเอียดแอป | clickable |
| `traffic-sign` | กำลังเตรียมระบบ | สมาชิกใช้ฟรี | ประกาศเมื่อ 26 ส.ค. 2569 | ดูรายละเอียดแอป | clickable |
| `land-acquisition` | กำลังเตรียมระบบ | เฉพาะบุคลากรกรมทางหลวง | ประกาศเมื่อ 26 ส.ค. 2569 | ดูรายละเอียดแอป | clickable |

The revoked card is silent in all three claim slots while still introducing the app — the state
ADR 0015 asks for, produced by a withdrawal rather than by never having been announced. Before any
announcement, all five cards read exactly like the `estimeter` row above; that baseline was
captured first so the change could be attributed.

## Across viewport widths

Widths were chosen to straddle the stylesheet's own breakpoints rather than to match device sizes,
because the rules change at 720px and 760px — eight declarations each — and that is where a
regression would hide.

| width | horizontal overflow | nav rows | all six nav destinations reachable | card claims |
|---|---|---|---|---|
| 1440 | none | 1 | yes | correct |
| 761 | none | 3 | yes | correct |
| 721 | none | 2 | yes | correct |
| 640 | none | 2 | yes | correct |
| 390 | none | 3 | yes | correct |
| 360 | none | 3 | yes | correct |

Every card's call to action was hit-tested at every width and returned itself.

## The mobile navigation, measured

`getComputedStyle` reports `flex-wrap: wrap` at all six widths, and `overflow-x: auto` from 760px
down. Both are applied; the wrap wins, so the container never overflows and the scroller it
switches on has nothing to scroll. `.site-nav .nav-links` sets the wrap at specificity 0-2-0 and the
media block's `.nav-links` sits at 0-1-0 — a media query adds no specificity. The scroller rules are
dead code, and the wrapping they lose to is the behaviour that ships. No destination is lost at any
width.

## Two false alarms, measured rather than declared

Both were reported as broken and neither was.

**The timestamp and the email looked joined** in the recent-announcements table. Rebuilding the
exact markup against the served stylesheet returned `display: block`, one client rect, and the span
36px below the cell's top inside a 64px cell — two lines, as written. `.admin-card__body` is a grid
but its children are the table wrapper, not the span. Nothing overrides the rule.

**The cookie notice did not appear.** `localStorage` held an acknowledgement written the previous
afternoon; `shouldShowNotice` returned false, which is the designed answer. A later clearing of that
key produced a second disappearance, and an instrumented probe recorded the write — the owner had
pressed the button in the automation window, which is visible on their desktop. Identical in cause
to the alarm recorded in the previous session's note.

## An outage that was not the product

Mid-verification every route began returning 500. The served error named a drizzle-orm module that
"was instantiated ... but the module factory is not available" — Turbopack's signature for a dev
server holding modules invalidated by a dependency change made underneath it. Restarting the dev
server and clearing `.next/dev` restored every route. No source file was at fault and none was
changed.

## What this does not cover

- `estimeter` is still revoked. Its announcement, and therefore the open-state card, the
  `/apps/estimeter` entry and the `/pricing` member-free list, were not re-verified after the
  outage.
- `/market/<slug>` and `/pricing` were not re-measured after the registry filled.
- The server-side refusal message for announcing a `member_free` app as open has still never been
  rendered to a screen; the rule itself is held by a unit test.
- The card answers "what does it cost" with an access category, never an amount. `doh_staff_only`
  says nothing about money at all, and the VIP figures live only on `/pricing`.
