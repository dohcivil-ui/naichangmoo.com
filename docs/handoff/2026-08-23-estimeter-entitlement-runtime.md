# Handoff — `v0.13.0: ESTIMETR Entitlement Runtime and Source Line Reconciliation`

## Description

This release does two things that had to happen in order.

First it reconciles the two development lines that had drifted apart from `edc9e02`. One line held the security and correctness work on the public intake (rate limiting, honeypot, hashed client IP, migration 0001, the `/apps/[slug]` session guard) and had never been version-bumped. The other line, `feature/estimeter-guided-assistant`, held the ESTIMETR workspace, the platform shell and design system, the CI workflow and the Vercel deployment fixes, and had published tags through v0.12.3. Leaving them apart would have meant rewriting one side and keeping a published version namespace that pointed at code the main line did not contain.

Second it turns the ESTIMETR entitlement from a written policy into enforced behavior. Before this release `src/lib/entitlement.ts` existed but nothing called it, no `apps` row existed, no organization or entitlement was ever created, and `/apps/estimeter` rendered the workspace to any signed-in user. The workspace now renders only after the server has read a real entitlement, resolved the capability set and counted the member's projects.

The trial follows ADR 0003 exactly: five days measured from `users.created_at`, one project, export and print locked, AI review allowed, and read-only retention after expiry. It is not measured from the first visit. See the risk note below, because that choice has a visible consequence.

## Changed scope

| Area | Files | Summary |
|---|---|---|
| Merge resolution | `postcss.config.mjs`, `src/app/apps/[slug]/page.tsx`, `src/lib/auth-session.ts` | Kept the `const config` form; combined the session guard with the app shell instead of choosing one side; added a session helper that keeps the guard without reintroducing the preview-build failure. |
| Entitlement policy | `src/lib/entitlement.ts`, `src/lib/estimeter-trial.ts` | Replaced permissive defaults with a per-state policy table; stored limits may now only narrow what a state allows. Added the computed `not_started` state and the trial window/countdown helpers. |
| Entitlement runtime | `src/server/estimeter-access.ts` | Registers ESTIMETR in `apps` from the code registry, issues the personal organization, membership, entitlement and audit event in one transaction, counts projects and returns a decided capability set. |
| Workspace gating | `src/app/apps/[slug]/page.tsx`, `src/components/estimeter/estimation-workspace.tsx`, `src/components/estimeter/entitlement-status.tsx`, `src/lib/estimeter-access-view.ts` | The workspace receives a server-decided view; every mutating control is disabled with a stated reason when the entitlement does not allow it. The static trial-policy demo was removed in favor of the account's real state. |
| Pre-entry honesty | `src/lib/platform.ts` | Restored the one-project cap in the trial label and replaced the ESTIMETR availability placeholder with the actual trial terms. |
| Tests | `src/lib/entitlement.test.ts`, `src/lib/estimeter-trial.test.ts`, `src/lib/estimeter-access-view.test.ts`, `src/server/estimeter-access.test.ts`, `src/server/estimeter-access.integration.test.ts` | 16 + 16 tests from the two lines merged to 28, then grew to 45 unit tests plus 3 opt-in database tests. |
| Governance | `docs/roadmap/roadmap.json`, `docs/roadmap/roadmap.v0.13.0.json`, `docs/roadmap/CHANGELOG.md`, `docs/handoff/index.json`, this note | Records IP-038 to IP-040. |

## Verification

`pnpm typecheck`, `pnpm lint` (0 warnings), `pnpm test` (45 passed, 3 skipped) and `pnpm build` all pass. `pnpm security:check` reports no local secrets or build directories.

The database path was exercised against local PostgreSQL, not only unit-tested. With `ESTIMETR_DB_TESTS=1`, `src/server/estimeter-access.integration.test.ts` confirms that a first visit produces exactly one entitlement and one audit event, that the window is derived from `users.created_at` so a late backfill cannot extend it, that a member created more than five days ago resolves to read-only with create/edit/AI locked, and that two concurrent first visits still produce a single entitlement row. The test creates its own members and deletes them afterwards; it is opt-in precisely because it writes to whatever `DATABASE_URL` points at.

## Security and data impact

No schema change and no migration. The runtime writes to `apps`, `organizations`, `organization_members`, `app_entitlements` and `audit_events` using identifiers derived from the member and app slug, so repeats and races collide on the primary key rather than issuing a second trial. Entitlement decisions are made server-side; disabled controls only make the decision visible. Reading the entitlement fails closed: if the check throws, the workspace is not rendered. The `limits` jsonb column is parsed as untrusted input and can only narrow permissions, so editing that column cannot unlock export on a trial. No secret, customer data or environment value entered Git.

## Risk

The trial clock starts at registration, not at first entry to ESTIMETR. A member who signs up and opens ESTIMETR eight days later sees an expired trial they never used. This follows ADR 0003, which explicitly rejected starting the trial at first project. If that outcome is not what the product wants, it is a policy change that needs a superseding ADR, not a code tweak.

Trial issuance currently happens on the first authenticated visit rather than in the registration hook. Because the window comes from `users.created_at`, the timing of the write changes nothing about what the member receives, but the write does happen during a page render. IP-040 moves it to the Better Auth registration hook and leaves the visit path as a backfill.

`next-env.d.ts` flips between the dev and production type paths depending on which command ran last, so it shows as modified after a build. It was deliberately left out of these commits.

`todo.md` at the repository root arrived with the merge and is agent scratch, not project documentation. It should be removed or moved under `docs/`.

## Rollback

`git revert` the two commits on `feature/estimeter-entitlement-runtime`, or return to branch `backup/pre-estimeter-merge` for the pre-merge state, or to tag `v0.12.3-source-verification` for the published line. No migration runs in this release, so no schema rollback is needed. Rows already written to `apps`, `organizations`, `organization_members`, `app_entitlements` and `audit_events` stay valid and simply go unread.

## Next action

Awaiting user approval to push `feature/estimeter-entitlement-runtime` and to create the annotated `v0.13.0` tag; neither was performed. After approval, the next slice is IP-040 followed by real project creation, which is the first slice that needs `canCreateAnotherProject` on a write path rather than on a screen.
