# Handoff — 2026-08-23 — ESTIMETR Project Lifecycle (v0.14.0)

## What this release does

Slice 1 decided what a member is allowed to do. This slice is the first place where that
decision guards a write. A member can now create a project and open it, and the one-project
trial cap is enforced inside the write transaction instead of by disabling a button.

ESTIMETR also stops sharing the generic `/apps/[slug]` page. It owns `/apps/estimeter`,
`/apps/estimeter/projects/new` and `/apps/estimeter/projects/{id}`, so its guard, layout and
routes are visible in one folder rather than hidden behind a slug comparison.

## Changed files

| File | Change |
|---|---|
| `src/lib/estimeter-project.ts` | new. Project name schema and `projectCreationDenial`, the single source of the reason a member cannot create a project. |
| `src/lib/estimeter-project.test.ts` | new. Parsing and denial-message cases per entitlement state. |
| `src/lib/thai-format.ts` | new. `formatThaiDate` / `formatThaiDateTime` pinned to Asia/Bangkok. |
| `src/lib/estimeter-access-view.ts` | `formatTrialDate` now delegates to the shared formatter. |
| `src/server/estimeter/project-repository.ts` | new. All project reads and the guarded write, scoped by organization. |
| `src/server/estimeter/project-repository.integration.test.ts` | new. Opt-in PostgreSQL tests, including the lock proof. |
| `src/server/estimeter/context.ts` | new. `resolveEstimeterContext`, the fail-closed entry check for every ESTIMETR page. |
| `src/server/estimeter-access.ts` | `EstimeterAccess` now carries `organizationId` for server-side scoping; the client view still does not. |
| `src/server/actions/estimeter-project.ts` | new. `createEstimeterProject`, re-checking session, entitlement and cap. |
| `src/app/apps/estimeter/layout.tsx` | new. Shared app chrome only, deliberately not a guard. |
| `src/app/apps/estimeter/page.tsx` | new. Entitlement status, real project list, then the guided demo. |
| `src/app/apps/estimeter/projects/new/page.tsx` | new. Short form, or the reason it is unavailable. |
| `src/app/apps/estimeter/projects/[projectId]/page.tsx` | new. Project record and workflow position, no invented numbers. |
| `src/app/apps/[slug]/page.tsx` | ESTIMETR redirects to its own route; other apps keep the existing boundary. |
| `src/components/estimeter/project-list.tsx`, `project-form.tsx`, `entry-blocked.tsx` | new UI, reusing existing panel/table/form classes. |
| `src/components/estimeter/estimation-workspace.tsx` | demoted to `h2` and no longer renders the entitlement panel, which the page owns. |
| `docs/roadmap/roadmap.v0.14.0.json`, `roadmap.json`, `CHANGELOG.md`, `docs/handoff/index.json`, `package.json` | governance and version records. |
| `todo.md` | removed. Its two unfinished items became IP-042 and IP-043 so the roadmap is the only backlog. |

No schema change and no migration. `projects` and `audit_events` are used as shipped.

## Verification

- `pnpm typecheck`, `pnpm lint` (0 warnings), `pnpm build`, `pnpm security:check` pass.
- `pnpm test` with `ESTIMETR_DB_TESTS=1`: 15 files / 63 tests passed.
- The concurrency test was written twice. The first version passed even with the row lock
  removed, so it proved nothing; it was replaced with a test that holds the organization lock
  open and asserts the second submit waits and is then refused. Removing `.for("update")`
  makes that test fail with two projects created under a one-project cap, which is the
  behaviour it is there to prevent.
- Unauthenticated requests to all three ESTIMETR routes returned the access gate, including a
  project id that does not exist, so nothing about project existence leaks before sign-in.
  `/apps/rcopt` still resolves through the dynamic route.

## Risk

- **Trial is one project, permanently.** A trial member who names a project badly cannot
  create another. There is no rename or delete yet. If this becomes a support problem, the
  fix is a rename action, not raising the cap.
- **Locking granularity.** Project creation is serialized per organization. That is correct
  for a cap of one and harmless at current volume, but an organization creating projects in
  bulk later will queue behind this lock.
- **Two entitlement reads per page load.** `resolveEstimeterContext` runs on each ESTIMETR
  page and re-reads the entitlement. Acceptable now; if it shows up in latency, cache it per
  request rather than trusting a value passed down from a layout.
- **Deliberate gap.** Project path (private or government), province and reference price month
  are not collected. `projects` has no column for them, and inventing a place to stash them
  would be worse than waiting for the schema slice. Every project is `work_type = building`.

## Rollback

Revert this commit, or return to tag `v0.13.0-estimeter-entitlement-runtime`. No migration
runs, so no schema rollback is needed. Rows already written to `projects` and `audit_events`
stay valid and simply become unreachable until the routes return.

## Next action

1. User approval, then push `feature/estimeter-project-lifecycle` and tag
   `v0.14.0-estimeter-project-lifecycle`.
2. Slice 3 — manual takeoff with evidence: `takeoff_runs` with `runner = 'manual'`,
   `takeoff_items` with unit and quantity, and `evidence_references`, still without a
   migration. This is the last slice that fits inside the current schema; slice 5 is where BOQ
   line items, price units and Factor F force a migration.
