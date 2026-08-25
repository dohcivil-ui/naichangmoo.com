# Handoff — `v0.41.0: A Card Introduces an App; the Registry Makes the Claims`

## Description

The four grill questions left unasked by v0.40.0 were asked, along with six more the answers
unlocked. All ten are settled, ADR 0015 records the rule, and the code now follows it.

The headline finding: **the card work was never blocked on a missing rule.** ADR 0014 §2 and §4
were accepted and only half implemented, and the ADR names the gap itself in its closing section
as IP-092. Meanwhile the landing page had been publishing **"ฟรี ทดลองใช้งาน 7 วัน"** for five apps
that no administrator has ever announced — the exact thing ADR 0014 exists to prevent.

Two corrections to what v0.40.0 wrote down, both found by reading the code rather than the note:

1. **The card did not merely *name* an unannounced app; it stated its terms.** `accessLabel[paid_trial]`
   is a commercial claim, not a category label. Narrowing the glossary to permit bare names would
   not have made the page legal.
2. **The registry cannot supply a price.** `apps` has no price column; all money lives in
   `pricing.ts` and is platform-wide. "Put the price on the card" could only ever mean an access
   *category*, or the same figure repeated on five cards.

## The rule, as settled

**Introduction may come from source. A statement must come from the registry.**

| on the card | kind | authority |
|---|---|---|
| name, `purpose`, icon, category | introduction | `platform.ts` |
| access label | statement | registry `access_model` |
| readiness label | statement | registry `enabled` |
| CTA wording | statement | registry `enabled` |
| "ประกาศเมื่อ ‹date›" | statement | registry `announced_at` |

No announcement, or an unreadable database, means the card renders its introduction and **goes
silent about every claim** — it does not disappear. Price is an access category, never a number.

## Changed Scope

| Area | Files | Summary |
|---|---|---|
| Governance | `docs/adr/0015-*.md` | Amends ADR 0014 §2 by reference, as 0014 extended 0013 |
| Glossary | `CONTEXT.md` | `ประกาศแล้ว` narrowed; `Trial` 5 วัน → 7 วัน |
| Registry | `src/server/app-registry.ts` | `readCatalogueClaims()` — one door, no failure case, by decision |
| Card rules | `src/lib/catalogue-card.ts` (new) | `describeCardClaims()` — the claiming rules, as a pure function |
| Card | `src/components/landing/app-card.tsx` | Takes a `claim`; renders `purpose`; right-hand column |
| Pages | `src/app/page.tsx`, `src/app/market/[slug]/page.tsx` | Read the registry; hero note gated |
| Contract | `src/lib/landing-interactions.ts` | `getAppInteractionContract(app, open)` — no longer reads `status` |
| Styling | `src/app/globals.css` | The missing `gap`; the right-hand column; progname and date |
| Design | `.design/ip-115/` | Two layouts and a three-state board; A was chosen |

## Why `describeCardClaims` exists

The project has no jsdom and `vitest.config.ts` includes only `*.test.ts`, so a component test
would have meant adding a testing stack — a dependency decision outside this work. Pulling the
claiming rules out of the markup made them testable in the environment that already exists, and it
is the better split anyway: the component is markup, and "may the card say this" has one answer in
one file.

## Verification

- `pnpm test` — 275 pass. New cases: an unannounced app renders no access, readiness or date; an
  unreadable database is *identical* to an empty registry; the registry's access model beats
  `seededAccess` when they disagree; the date appears only while announced-and-not-open.
- Looked at in a browser at `localhost:3000` **before** any announcement: five named cards, silent
  on every claim, and the two cards in `หมวดประมาณราคา` no longer touching.
- The rendered landing page contains **zero** occurrences of "ทดลองใช้งาน 7 วัน", down from two.
- `npx tsc --noEmit` clean; `npm run lint` leaves only the pre-existing warning in
  `thai-baht.test.ts`; `check-roadmap.mjs` and `security:check` pass.

## Seen and left alone, deliberately

**The entry panel now contradicts itself on `/market/estimeter`.** The heading reads
*ยังไม่เปิดให้เข้าใช้* (registry) directly above *ทดลองใช้งานฟรี 7 วัน* (`marketDetail.availabilityNote`,
source). That sentence is governed on purpose by **ADR 0010** — "one sentence everywhere before
entry" — so narrowing it is an amendment, not an edit, and it is not this change's to make.
**IP-122.**

Checked and *not* a bug: `availabilityNote` omitting the one-project limit looked like an ADR 0009
violation, but ADR 0009's own header records that row as superseded by ADR 0010.

## Not seen by human eyes yet

**The announced states.** ADR 0014 forbids a seed script because announcing is a human act with an
actor recorded, so no announcement was made on the owner's behalf. The announced-and-open and
announced-not-yet-open states are held by tests, not by a screenshot.

Still outstanding from v0.40.0: `/account` has only ever been checked for a 200, the
sign-out-other-devices button has never been pressed, and the Google avatar has not been observed
loading. **IP-114.**

## Security and data impact

None. No migration, no schema change, no write path touched. The change can only make the public
pages say *less* than before, never more.

## Rollback

Revert the commit. If an announcement has been made in the meantime, revoke it in the back office
as well — which clears `announced_at` without deleting the row, per ADR 0014 §6.

## Next action

1. **Announce the five apps in the back office** as the granted administrator. `rcopt` and
   `traffic-sign` are `member_free` and must be announced with **open = false**; `announceApp`
   refuses otherwise (ADR 0014 §3). This doubles as **IP-094**, the browser verification the
   registry has never had.
2. **IP-114** — `/account`, and press the button.
3. **IP-122** — decide whether the pre-entry sentence is a claim too.
4. **IP-113** — the two displaced back-office tests.
