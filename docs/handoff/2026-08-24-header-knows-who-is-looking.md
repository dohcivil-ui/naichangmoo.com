# Handoff — `v0.37.0: The Header Knows Who Is Looking`

`/grill-with-docs` was not run. The session began as verification of already-built back-office work, and the UI work that followed arrived as live corrections from the owner while a browser was open in front of them. Every decision that would have gone to the grill was instead put to the owner directly and answered before code was written. Recording the skip here rather than claiming the step happened.

## Description

The platform could sign a person in and then showed no sign of it: the header rendered the sign-in button whether or not a session existed, and the string `signOut` appeared nowhere in the codebase. This version gives the header an account menu that names the viewer, states which apps they hold and in what state, says whether they are an administrator, and — for the first time — offers a way out. It adds `/account`, where a member reads their own entitlements, organizations and open sessions and can close the other ones. Along the way it fixes the bug that made every Google sign-in fail, and gives every app a Thai program name and a one-line purpose rendered in the same place.

## Changed Scope

| Area | Files | Summary |
|---|---|---|
| Auth schema | `src/db/schema.ts`, `drizzle/0007_handy_lorna_dane.sql` | Adds `accounts.issuer`. better-auth 1.7 looks an account up by `(issuer, accountId)`; without the column the Drizzle adapter emitted `where ( = $1 …)` and Postgres rejected it, so every OAuth callback returned `internal_server_error`. The migration is three steps — add nullable, backfill per provider, then `SET NOT NULL` — so a database with existing rows fails at the constraint, which names the problem, instead of at `ADD COLUMN`, which does not. |
| Session | `src/lib/auth-session.ts` | `PlatformSessionUser` now carries `image`, the avatar the provider vouched for. |
| Header | `src/components/platform/site-header.tsx` (new), `platform-nav.tsx`, `account-menu.tsx` (new) | One server component reads the session and passes it down; the nav stops rendering a sign-in button unconditionally. The menu is a card: identity, role, apps with state and expiry, settings, back office for administrators, sign out last. |
| Account page | `src/app/account/page.tsx` (new), `src/components/platform/sign-out-others.tsx` (new), `src/server/actions/account.ts` (new), `src/server/member-account.ts` (new) | Read-only view of the member's own data, plus one action: end every other session. The action re-checks the session itself because a server action is its own entry point. |
| Contract | `src/lib/landing-interactions.ts`, `src/lib/platform-admin-labels.ts` | `getAccountInteractionContract` decides what the corner shows, so that reasoning is unit-tested rather than embedded in JSX. Two effective-only states gained labels. |
| App identity | `src/lib/platform.ts`, `src/components/platform/app-shell.tsx` | `programName` and `purpose` are required on every app and render in one fixed position. The ค่า K app is registered as `coming_soon`. |
| Layout | `src/app/globals.css` | The header had been overlapping its own nav pills at every width, because `.container` caps at 1160px and the bar carries more than the body does. The bar now takes 1400px of its own and the wordmark drops from 84px to 58px inside it. |
| Tests | `src/lib/landing-interactions.test.ts`, `src/lib/platform.test.ts`, `src/server/app-registry.test.ts`, `src/server/estimeter-access.integration.test.ts` | Two hard-coded app counts were replaced with values derived from the registry — a literal `4` stops testing "every app" the moment a fifth is added. The integration test still asserted a 5-day trial that ADR 0009 changed to 7. |
| Dev fixtures | `scripts/seed-dev-fixtures.mjs` (new) | Idempotent local fixtures with an exact `--purge`, refusing any database that is not on this machine. |

## Verification

- `pnpm test` — 264 passed, 33 skipped (previous baseline 252).
- `pnpm typecheck`, `pnpm lint` — pass. One pre-existing warning in `thai-baht.test.ts`, untouched by this work.
- `ESTIMETR_DB_TESTS=1` integration suites — 33/33 after correcting the stale 5-day assertions.
- `pnpm db:migrate` — 0006 and 0007 applied; re-running is a no-op; `accounts.issuer` is `NOT NULL`.
- Migration 0007 exercised against a throwaway copy holding rows, in four cases: empty, google only, all three configured providers, and an unregistered provider. The fourth fails at `SET NOT NULL` and names the null column, which is the intended behaviour.
- Google sign-in completed end to end with a real account. `users`, `accounts` (issuer `https://accounts.google.com`), `sessions`, a personal organization and a 7-day trial entitlement were all written, and checked in the database.
- `scripts/grant-platform-admin.mjs` granted the first administrator and then refused a second run, as designed. Audit event `platform_admin.bootstrapped` with a null `granted_by`.
- The owner confirmed in a browser that the account menu opens and closes.
- **Not verified:** `/account` was only checked for a 200 with no server error. Nobody has looked at it. The "sign out other devices" button has never been pressed.
- **Not verified:** the Google avatar has not been seen rendering. Only that the URL is stored and that `next.config.ts` now permits the host.

## Security and data impact

- **Migration:** `accounts.issuer` added, `NOT NULL`. Reverting it breaks Google sign-in, because better-auth 1.7 requires it.
- **Secrets:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `NEXT_PUBLIC_AUTH_ENABLED` were filled in by the owner in `.env`. No credential was read, printed or committed by the agent; only the presence and shape of the values were checked.
- **PII:** `/account` displays the member's own name, email, avatar URL, organizations and session timestamps. Session rows deliberately expose neither token nor IP address. Nothing here crosses the ADR 0013 line, which governs the platform reading a customer's work, not a customer reading themselves.
- **Third parties:** the avatar is fetched server-side through Next's image optimizer rather than by the browser, so opening our pages does not announce the viewer to Google. `lh3.googleusercontent.com` is the only host added to `remotePatterns`.
- **Permissions:** unchanged. `/admin` still refuses on the server per ADR 0012; the "หลังบ้าน" link is a shortcut drawn for administrators, never a check.

## Rollback

Return to the commit before this one on `feature/app-registry-announced`. The migration is the caveat: `accounts.issuer` must be dropped by hand, and dropping it returns Google sign-in to failing on every callback.

## Next action

**IP-105** — let a member edit their own profile: real name, uploaded photo, contact details, and consent to receive news. This is larger than it looks and should not be started as a form:

- a photo upload needs storage; R2 is configured in `.env` but nothing writes to it yet, and an uploaded avatar has to survive the provider's own avatar being refreshed (IP-108),
- real name and contact details are new columns and a migration, and they compete with the provider-supplied name — one of the two has to be authoritative,
- consent to receive marketing is a PDPA matter in Thailand. What was consented to, when, and by which act has to be recorded, and withdrawal has to be as easy as giving it. That is a decision worth an ADR, not a boolean column.

**Known blocker for IP-109:** the owner reported that printing to PDF does not work. It is not a bug. `entitlement.ts` sets `printEnabled: false` and `exportEnabled: false` for `trial`, and ADR 0003 — reaffirmed by ADR 0006 and ADR 0009 — states that the trial closes export and print. Changing it needs a superseding ADR.

**Also open:** the ค่า K app borrows the platform mark as its badge (IP-107). It is commented as a placeholder in `platform.ts` and must be replaced before the app is announced.
