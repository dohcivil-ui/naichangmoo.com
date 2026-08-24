# Handoff — `v0.39.0: A Card Should Answer the Question Being Asked`

`/grill-with-docs` was not run. This version changes no source code — it records a design decision reached with the owner in conversation, with the reasoning that produced it. The grill's job here was done by the owner pushing back directly.

## Description

The owner asked why our app cards do not look like a competitor's, and said the spacing was wrong. Both observations were correct, and they turned out to have different causes: one is a plain bug, one is a layout mistake, and one is not a spacing problem at all — the card simply does not say enough. This note records what a catalogue card is for, what it may claim, and what it must never claim.

No code changed. Implementation is IP-115 through IP-119.

## What a card is for

Someone scrolling the app list is asking four questions, in this order:

1. What is this?
2. Can I use it now, or not yet?
3. **What does it cost me?**
4. What do I press?

Today's card answers the first in three words, skips the third entirely, and answers the fourth. Price lives on `/pricing`, so learning it costs a visit to another page and a trip back.

**That is the finding worth keeping: a clean-looking card that withholds the price is not simple.** Simplicity is measured in decisions, not in words. Sending someone away to learn the price turns one decision into three, and the tidiness of the card is what hides that.

The competitor's card answers roughly seven questions and invents one of the answers. Ours answers two and a half. Neither number is the target — four is.

## The three separate problems behind "the spacing is bad"

| # | Problem | Cause | Item |
|---|---|---|---|
| 1 | Two cards in one category touch, reading as one box split by a hairline | `.market-category__apps` has **no `gap`**, while every sibling grid in the same file has one (`.app-grid` 16px, `.market-category-stack` 18px). Invisible until a category held more than one app — registering the K-factor app exposed it | IP-116 |
| 2 | The access badge floats in the middle of the card, aligned with nothing | The horizontal card is a 3-column grid (`104px \| 1fr=790px \| 180px`), but the badge sits inside `.app-card__topline`, which uses `justify-content: space-between` **within the middle column** — so it pins to x=790, not to the actions column. The topline was designed for the vertical card, where it spans the full width | IP-115 |
| 3 | A large void in the middle of every card | The middle column is 790px and `description` for ESTIMETR is three words. Nothing is mis-spaced; there is nothing to put there. `purpose` (added in v0.38.0 for the app header) is the sentence that belongs here | IP-115 |

## What a card may claim — the decision

The competitor shows a development-progress percentage ("พัฒนาแล้ว 35%") on unreleased apps. **We will not.**

Not on principle alone. On three practical grounds:

- **Nobody can compute it.** It would be typed in by hand each week, which means it moves when someone wants it to move, not when the work moves.
- **It stalls.** Every such number reaches 90% and sits there. A figure that stops moving while the calendar does not is worse than no figure.
- **It proves nothing.** A visitor cannot check it against anything.

But the percentage does a real job: it says *someone is still working on this*, which matters more for an unreleased app than for a released one. So the job stays and the mechanism changes:

> ESCALATION K · กำลังพัฒนา · **อัปเดตล่าสุด 24 ส.ค. 2569**

A date is stronger than a percentage because it is checkable, because it comes from `apps.announced_at` (added by IP-090's migration 0006) rather than from someone's judgement, and because **it indicts us when we stop.** A percentage frozen at 90% looks like progress; a date three months old looks like exactly what it is. That asymmetry is the point, and it is a constraint we are choosing to accept rather than one we are working around.

## Deliberately deferred

**Search and filtering.** Five apps in four categories fit on one scrollable page; a search box over five items is furniture. The competitor needs six categories because they carry fourteen apps. Revisit at roughly ten — stated as a number so it is a trigger rather than a matter of taste (IP-118).

## Changed Scope

| Area | Files | Summary |
|---|---|---|
| Roadmap | `docs/roadmap/roadmap.v0.39.0.json`, `roadmap.json` | Five items, IP-115 to IP-119 |
| Handoff | this note, `docs/handoff/index.json` | The decision and the reasoning behind it |

No source file changed.

## Verification

- Grid values read from `globals.css` rather than estimated: the middle column computes to 790px inside the 1160px container (1116 inner − 104 − 21 − 21 − 180).
- Confirmed `.market-category__apps` carries no `gap`, and that both sibling grids in the same file do.
- Confirmed `apps.announced_at` already exists, so IP-117 needs no migration.
- `node scripts/check-roadmap.mjs` passes.

## Security and data impact

None. Documentation only.

## Rollback

Revert this commit. No code, no schema, no data.

## Next action

**IP-116 first** — it is one CSS property and the only outright bug of the three.

Then **IP-115**: draft two or three card layouts and let the owner choose from something visible rather than from prose. The owner asked for this explicitly, and it will settle in one exchange what several written rounds would not.

**IP-119 before IP-117 ships.** The progress-percentage question will be asked again the next time a competitor ships one, and the answer should already be written down rather than re-argued.
