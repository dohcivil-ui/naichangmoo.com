# Handoff — `v0.38.0: Session Close — The Back Office Was Tested, and the Header Learned Who Is Looking`

`/grill-with-docs` was not run. The session opened as verification of already-built work and turned into UI corrections the owner made live with a browser in front of them; every question that would have gone to the grill was put to the owner and answered before code was written. Recorded here rather than claimed.

## Description

Two stretches of work in one day, on one branch. The first set out to test the back office that four earlier commits had built and never run — and found it could not be opened at all, for three reasons stacked on top of each other. The second began when the owner, finally inside a working site, noticed the header still behaved as though nobody had signed in. Between them, three real bugs were found and fixed, one of which had made Google sign-in fail on every attempt since it was configured.

This note supersedes nothing; it collects both stretches so the next session does not have to read two documents and infer the join. The narrower note for the second stretch alone is `2026-08-24-header-knows-who-is-looking.md`.

## Stretch one — testing the back office

`/admin` refused everyone, always, and the refusal was correct each time for a different reason:

1. **Migration 0005 had never been applied.** The database held 5 of 6 migrations and had no `platform_administrators` table, so `resolvePlatformAdmin` threw, caught, and returned `unavailable`. That is ADR 0012 working: a lookup that fails is not evidence of permission.
2. **Nobody could sign in.** `auth.ts` enables a provider only when its credentials exist, and all three were blank. There is no email-and-password path by design.
3. **The database was empty.** Every card would have rendered its empty state.

What was verified once those were cleared, all of it through the real code paths rather than by reading them:

- `/admin` answers with the right refusal for the right reason at each stage — `unavailable`, then `unauthenticated`, then `not_an_administrator`, then entry.
- Every figure on the overview matches a direct SQL count. The "unclosed quotation requests" tile reads 2 against 3 rows, which is the `ne(status, 'closed')` filter doing its job rather than a total being echoed.
- **ADR 0013 holds where it matters.** Searching a seeded project's real name returns nothing. An organization-scoped audit event written during an entitlement change does not appear in the platform overview's recent-events table — filtered at the data layer, not merely unrendered.
- The mandatory-reason rule refuses an empty reason, a reason under four characters, an unknown entitlement id and a state outside `ADMIN_SETTABLE_STATES`, and in each case the row is unchanged. A valid change writes the audit event with actor, reason, and before/after states.
- `scripts/grant-platform-admin.mjs` granted the first administrator and then refused the second run, as its comment promises.

**Still not done from the original plan:** posting to the entitlement server action without a cookie, and revoking one's own administrator grant. Both were displaced by the UI work and are the first things to pick up.

## Stretch two — the account menu and app identity

The site could sign a person in and then showed no sign of it. `signOut` appeared nowhere in the codebase; a member on a shared machine had no way to leave. Fixed with a card, not a list of links: identity, which side of the administrator line the viewer is on, each app with state and expiry, settings, the back office for administrators, and sign out last — it ends the session, so it does not sit where a mis-click lands.

Two decisions worth restating because they went against what was asked:

- **There is no account-wide status line.** Status belongs to an entitlement, and one member can hold several in different states at once, so any single summary word would be right for the first app and wrong for the rest. Status lives on each app's row instead.
- **A day count is only shown while it is short enough to act on.** "เหลือ 335 วัน" on an annual entitlement is noise, and noise in a status line is how a status line stops being read.

`/account` shows the same data in full, adds the organizations a member belongs to — which nothing had ever told them existed, though entitlements are held by an organization and not by a person — and can close every other open session.

Every app now carries a Thai program name and a one-line purpose rendered in one fixed position, so arriving from a link never leaves someone guessing what they opened. The K-factor app is registered as `coming_soon`: named before it is routed.

## The three bugs

| Bug | Cause | Why it mattered |
|---|---|---|
| Google sign-in failed on every callback | better-auth 1.7 identifies an account by `(issuer, accountId)`. `accounts` had no `issuer` column, so the Drizzle adapter could not resolve the field and emitted `where ( = $1 …)`. Postgres answered with a syntax error, better-auth turned that into `internal_server_error`. | The owner had already spent ten minutes in the Google Cloud console before hitting this. It was findable beforehand with no credentials at all, by comparing the library's expected tables against ours. That is the process lesson of the day. |
| `--purge` in the new seed script failed | `audit_events.organization_id` and `actor_id` reference their parents with no cascade, so an audit event written during testing blocked the delete. | The transaction rolled back and no data was lost, but the script was unusable until three more tables were cleared first. |
| DB integration suite failed 2 of 33 | Commit `5fc234d` changed the trial from 5 days to 7 per ADR 0009 and left three stale assertions behind, including one whose expiry date would only fail once the first was corrected. | Verified against ADR 0009 before changing anything: the product code was right and the test was stale, not the other way round. |

The migration for `accounts.issuer` is deliberately three statements — add nullable, backfill per provider, then `SET NOT NULL`. A single `ADD COLUMN … NOT NULL` against a table with rows fails at the `ADD`, which says nothing about which rows are the problem. Two other sessions independently raised this; both were right.

## Changed Scope

| Area | Files | Summary |
|---|---|---|
| Auth schema | `src/db/schema.ts`, `drizzle/0007_handy_lorna_dane.sql` | `accounts.issuer`, added in three safe steps. |
| Session | `src/lib/auth-session.ts` | `PlatformSessionUser` carries the provider's avatar URL. |
| Header | `site-header.tsx`, `platform-nav.tsx`, `account-menu.tsx` | Session read once on the server and passed down; the account corner is a card. |
| Account | `src/app/account/page.tsx`, `sign-out-others.tsx`, `src/server/actions/account.ts`, `src/server/member-account.ts` | The member's own view, plus one action that ends other sessions and re-checks the session itself. |
| Contract | `landing-interactions.ts`, `platform-admin-labels.ts` | What the corner shows is a tested pure function, not logic inside JSX. |
| App identity | `platform.ts`, `app-shell.tsx` | `programName` and `purpose` required on every app; ค่า K registered. |
| Layout | `globals.css` | The bar had been overlapping its own nav pills at every width, because `.container` caps at 1160px and the bar carries more than the body. |
| Tests | `landing-interactions.test.ts`, `platform.test.ts`, `app-registry.test.ts`, `estimeter-access.integration.test.ts` | Two hard-coded app counts became values derived from the registry. |
| Dev fixtures | `scripts/seed-dev-fixtures.mjs` | Idempotent, exact `--purge`, refuses a database that is not on this machine. |
| Config | `next.config.ts` | One image host, so the avatar is fetched by our server rather than by the viewer's browser. |

## Verification

- `pnpm test` — 264 passed, 33 skipped. Baseline at session start was 220.
- `pnpm typecheck`, `pnpm lint` — pass; one pre-existing warning in `thai-baht.test.ts`, untouched.
- `ESTIMETR_DB_TESTS=1` — 33/33 after the stale trial assertions were corrected.
- `node scripts/check-roadmap.mjs`, `pnpm security:check` — pass.
- `pnpm db:migrate` — 0006 and 0007 applied; re-running is a no-op.
- Migration 0007 exercised against a throwaway copy holding rows in four cases, including an unregistered provider that must fail at `SET NOT NULL` and name the null column.
- Real Google sign-in completed; `users`, `accounts`, `sessions`, a personal organization and a 7-day trial were all written and checked in the database.
- The landing page renders all five app cards, the K app among them with its "กำลังพัฒนา" note.
- The owner confirmed the account menu opens and closes in a browser.
- **Not verified:** `/account` has never been looked at — only checked for a 200 with no server error. The "sign out other devices" button has never been pressed. The Google avatar has not been seen loading. Posting to the entitlement action without a cookie, and self-revocation of an administrator grant, were both planned and not done.

## Security and data impact

- **Migration:** `accounts.issuer`, `NOT NULL`. Reverting it returns Google sign-in to failing.
- **Secrets:** the owner filled `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `NEXT_PUBLIC_AUTH_ENABLED` in `.env`. No credential was read, printed or committed; only presence and shape were checked.
- **PII:** `/account` shows the member their own name, email, avatar, organizations and session timestamps. Session rows expose neither token nor IP address on purpose. This is a member reading themselves, which is not what ADR 0013 governs.
- **Third parties:** the avatar goes through Next's optimizer, so opening our pages does not announce the viewer to Google. `lh3.googleusercontent.com` is the only host in `remotePatterns`.
- **Permissions:** unchanged. `/admin` refuses on the server; the "หลังบ้าน" link is a shortcut, never a check.

### Cookies — what is actually set today

Checked by request rather than assumed:

| When | Cookie | Kind |
|---|---|---|
| Landing page | none at all | — |
| Sign-in begins | `better-auth.state`, HttpOnly, SameSite=Lax, 5 minutes | strictly necessary (CSRF) |
| After sign-in | better-auth session cookie | strictly necessary |
| Analytics, pixels, tag managers | none anywhere in `src/` | — |

So the site sets only strictly necessary cookies. Under PDPA those need **disclosure, not consent** — and there is no privacy or cookie page anywhere, nor a footer link to one. A consent banner added today would ask permission for cookies that get set regardless, which is consent theatre: it produces a pile of meaningless records and looks like compliance. The banner becomes genuinely required the moment the planned LINE OA, Facebook, TikTok, Instagram or YouTube embeds arrive, because those set tracking cookies as the page loads. Build the disclosure now and the real mechanism before the first pixel, not the other way round.

## Not a bug, though reported as one

Printing to PDF is refused during a trial because `entitlement.ts` sets `printEnabled: false` and `exportEnabled: false` for `trial`, and ADR 0003 — reaffirmed by ADR 0006 and again by ADR 0009 — says the trial closes export and print. Changing it needs a superseding ADR. Filed as IP-109 so it is a decision rather than a defect.

## Rollback

Return to the commit before `e5f60b3` on `feature/account-menu-and-app-identity`. The migration is the caveat: `accounts.issuer` must be dropped by hand, and dropping it breaks Google sign-in again.

## Next action

1. **Look at `/account`** and press the sign-out-other-devices button. Four sessions are open from repeated sign-in attempts; it should leave one.
2. **Finish the two displaced back-office tests** — post to `changeEntitlement` with no cookie, and revoke the administrator grant from the account that holds it, confirming `grant-platform-admin.mjs` becomes runnable again.
3. **IP-110** — privacy and cookie disclosure page plus footer link. Small, and required from today.
4. **IP-105 with IP-111** — profile editing and consent are one system, not two. A photo upload needs R2, which is configured and unused; real name competes with the provider-supplied name and one has to win; and consent must record what was agreed, when, by which act, against which policy version, with withdrawal as easy as granting. Worth an ADR before any of it is built.

**Known placeholder:** the ค่า K app wears the platform mark as its badge, commented as a placeholder in `platform.ts`. Replace it before the app is announced (IP-107).
