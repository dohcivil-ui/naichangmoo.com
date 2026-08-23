# Handoff — `v0.10.0: ESTIMETR Traceable BOQ Estimation Workspace`

## Description

ESTIMETR now opens a focused, interactive workspace rather than the generic application placeholder. The page guides a user through drawing/specification review, quantity take-off, unit-cost estimation and BOQ compilation. Each stage has an explicit gate and an evidence context; the screen is deliberately a non-persistent demo and does not claim that any shown quantity, price or document is ready to use.

## Changed Scope

| Area | Files | Summary |
| --- | --- | --- |
| ESTIMETR route | `src/app/apps/[slug]/page.tsx` | Renders the dedicated workspace only for `estimeter`; other applications retain the shared placeholder. |
| Estimation workspace | `src/components/estimeter/estimation-workspace.tsx`, `src/app/globals.css` | Adds four sequential work states, evidence ledger, unit-aware take-off table, source-of-price state and BOQ readiness state. |
| Workflow policy tests | `src/lib/estimation-workflow.ts`, `src/lib/estimation-workflow.test.ts` | Moves stage availability into pure functions and covers sequential-gate behavior. |
| Research and validation | `docs/research/boq-workflow-reference-2026-08-22.md`, `docs/verification/estimeter-workspace-validation-2026-08-22.md` | Records BOQ workflow sources, browser progression results and a mobile viewport check. |

## Verification

`pnpm lint`, `pnpm test` (4 files / 8 tests), `pnpm typecheck` and a credential-less `DEPLOY_TARGET=vercel NODE_ENV=production pnpm build` pass. Browser smoke testing progresses from drawing review through BOQ compilation without exposing a live export, and a 375 × 812 viewport preserves the readable header and horizontally scrollable step rail. The release gate still requires the security preflight, roadmap validation, diff check, commit/tag/push and a public Vercel review after deployment.

## Security and data impact

This release introduces no database migration, persistence, upload, authentication, payment, secret, customer data, AI execution or Hermes-policy change. The screen explicitly labels its sample values as a demo. It keeps price-source selection pending and Export approval incomplete so that the interface cannot be mistaken for a live price or document workflow.

## Rollback

Return to `v0.9.2-estimetr-terminology`. No migration or user data rollback is required.

## Next action

Publish and review the Vercel pilot. Once the user approves the workspace direction, connect project storage, drawing revisions, auditable AI take-off evidence, TPSO price sets and server-side export/entitlement enforcement in a separate scoped release.
