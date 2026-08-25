# Handoff — `v0.40.0: Open Questions Before the Card Work`

`/grill-with-docs` was invoked and got as far as fact-finding and a first round of questions before the session ran out of context. The questions are written out below rather than lost. **Ask them at the start of the next session; do not start the card work without answers.**

## Description

No source changed. This note exists because two findings and one unasked round of questions would otherwise die with the conversation that produced them. Everything a fresh session needs to resume is here.

## Where things stand

Four commits pushed on `feature/account-menu-and-app-identity`:

| commit | what |
|---|---|
| `e5f60b3` | account menu, `/account`, app identity header, the `accounts.issuer` fix that made Google sign-in work at all |
| `cde1d30` | combined handoff + roadmap v0.38.0 + the cookie audit |
| `62c334f` | corrected the K-factor app's seeded access from `member_free` to `paid_trial` |
| `517d332` | roadmap v0.39.0 + the card decision note |

**Environment, as left:** dev server running on `localhost:3000` (LAN `192.168.1.110:3000`, same Wi-Fi only) · Postgres migrated 8/8 · seed fixtures loaded (`scripts/seed-dev-fixtures.mjs`, purge with `--purge`) · a real member `doh.civil@gmail.com` signed in, holding a 7-day ESTIMETR trial and **granted platform administrator** · Google OAuth credentials present in `.env`.

## Two findings nobody has decided on

### 1. The glossary claims more than the system does

`CONTEXT.md` defines **ประกาศแล้ว (Announced)** as: *"แอปที่ยังไม่ถูกประกาศจะไม่ถูกเอ่ยชื่อบนหน้าสาธารณะ แม้ระบบจะรู้จักแอปนั้นอยู่ก็ตาม"*

The landing page names five apps. **None of them is announced** — the `apps` table holds one row (`estimeter`) and its `announced_at` is null. So by the glossary's own words the most public page in the product is in continuous violation.

But the same glossary defines **ค่าตั้งต้นของสิทธิ์ (Seeded Access)** as *"ป้ายบอกหมวดในหน้าแนะนำแอปเท่านั้น"* — explicitly sanctioning a source-derived label on the browsing page. The two entries pull against each other.

ADR 0014 §2 implements the rule only on `/pricing` (the member-free card and the restricted-app footnote). It never mentions the landing page.

**So: is the glossary aspirational and too broadly worded, or is the landing page wrong?** This is Q3 below. It needs the owner, not a guess, and it should be settled before any card work touches what the card is allowed to say.

### 2. `announced_at` is not "last worked on"

v0.39.0's IP-117 proposes replacing a competitor's development-progress percentage with a real date. The reasoning holds. The column named does not: `announced_at` records **when an administrator announced the app**, not when work last happened — and an unannounced app has no date at all, which is precisely the case (an unreleased app) the date was meant to serve.

The previous session conflated two different dates. Either a different source is needed, or the claim on the card has to change. Filed as IP-121.

## The grill round that was never asked

Recommendations are the previous session's, offered as a starting position, not as settled.

**Q1 — Scope.** Is the grill about the card work (IP-115…IP-119), profile editing and consent (IP-105/111/112), or pricing?
→ *Recommend: the card work.* It is what the owner asked for mockups of.

**Q2 — Where does a price on a card come from?** (a) `seededAccess` in source — quick, but it makes a commercial claim out of the one thing the glossary says is not a declaration, which is what ADR 0014 exists to prevent. (b) From the registry, failing closed into **silence about price** when the database cannot be read, the same way the member-free card already does. (c) Don't put price on a card at all.
→ *Recommend: (b).*

**Q3 — May the landing page name an unannounced app?** (a) Yes — the landing page is a browsing surface, not a declaration; narrow the glossary so the rule covers claims about **access and price**, not the mere mention of a name. (b) No — derive from the registry, which today removes all five cards until someone announces them in the back office.
→ *Recommend: (a).* (b) empties the landing page tonight, and naming an app to introduce it is a different act from stating what it costs. See finding 1.

**Q4 — How many card variants change?** `.app-card` serves two surfaces: `.app-grid` (vertical, four across, landing) and `.market-category__apps` (horizontal rows, category page — the one the owner photographed).
→ *Recommend: both.* Different shapes are fine; answering different questions is not.

**Later rounds, blocked on the above:** which date the card shows · whether IP-119's ADR is still the right shape once Q2 and Q3 are answered · two or three card layouts for the owner to choose between.

## What is already known about the cards — do not re-derive

- `.market-category__apps` has **no `gap`**, while both sibling grids in the same file do (`.app-grid` 16px, `.market-category-stack` 18px). Two cards in a category touch and read as one box split by a hairline. Invisible until a category held more than one app.
- The horizontal card is `104px | 1fr = 790px | 180px`. The access badge sits in `.app-card__topline`, which uses `justify-content: space-between` **inside the middle column**, so it pins to x=790 — aligned with nothing in the actions column.
- The middle column is 790px and ESTIMETR's `description` is three words. `purpose`, added in v0.38.0 for the app identity header, is the sentence that belongs there.
- The owner has agreed a card must answer exactly four questions: what is this · can I use it now · what does it cost · what do I press.

## Not seen by human eyes yet

`/account` has only ever been checked for a 200 with no server error. The "sign out other devices" button has never been pressed — four sessions are open, so it should leave one. The Google avatar has not been observed loading.

## Checked and not a bug

Printing to PDF is refused during a trial: `entitlement.ts` sets `printEnabled: false` and `exportEnabled: false` for `trial`, and ADR 0003 — reaffirmed by ADR 0006 and ADR 0009 — closes export and print for the whole trial. Changing it needs a superseding ADR (IP-109).

## Changed Scope

| Area | Files | Summary |
|---|---|---|
| Roadmap | `docs/roadmap/roadmap.v0.40.0.json`, `roadmap.json` | IP-120, IP-121 |
| Handoff | this note, `docs/handoff/index.json` | The findings and the unasked questions |

No source file changed.

## Verification

- `node scripts/check-roadmap.mjs` passes.
- `pnpm security:check` passes.
- Confirmed by query, not by reading code: the `apps` table holds one row and `announced_at` is null.
- Confirmed the landing page renders five app cards from `platformApps` in source.

## Security and data impact

None. Documentation only.

## Rollback

Revert this commit. No code, no schema, no data.

## Next action

1. Ask Q1–Q4 above.
2. **IP-116** — add the missing `gap`. One property, and the only outright bug of the three.
3. **IP-115** — build two or three card layouts and let the owner choose from something visible.
4. **IP-114** — look at `/account` and press the button. **IP-113** — the two back-office tests displaced by UI work: post to `changeEntitlement` with no cookie, and revoke the administrator grant from the account holding it.
