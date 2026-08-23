# Handoff — `v0.10.1: ESTIMETR Public Pilot Verification`

## Description

This verification release records a successful public review of the ESTIMETR workspace introduced in v0.10.0. The Vercel pilot for commit `f586a8a` is ready and exposes the intended ESTIMETR workspace, Landing and Roadmap/Handoff routes without enabling real database, authentication, payment, price-source or Hermes operations.

## Changed Scope

| Area | Files | Summary |
| --- | --- | --- |
| Verification record | `docs/verification/estimeter-workspace-validation-2026-08-22.md` | Adds public deployment and roadmap-route verification results. |
| Release governance | `docs/roadmap/roadmap.v0.10.1.json`, `docs/roadmap/roadmap.json`, `docs/roadmap/CHANGELOG.md`, `docs/handoff/index.json` | Adds the immutable verification snapshot and advances the active roadmap pointer. |

## Verification

Deployment `dpl_7oBAbLSDCrVymULJHwxpTPtNczJp` for commit `f586a8a8fb0949351b940f5d67ad47a5bed8b8c2` reached `READY`. The following public routes rendered successfully:

| Route | Result |
| --- | --- |
| `/apps/estimeter` | Four-stage ESTIMETR workspace begins at drawing review and clearly identifies demo/price-source states. |
| `/` | Landing navigation and ESTIMETR product card remain accessible. |
| `/roadmap` | Shows version `0.10.0` and its handoff source before this documentation-only follow-up. |

The v0.10.0 quality gate had already passed: lint, 4 Vitest files / 8 tests, typecheck, credential-less production build, security preflight, roadmap validation and `git diff --check`.

## Security and data impact

No production configuration or product code is changed in this release. There is no migration, persistence, external data fetch, upload, authentication, payment or Hermes capability change. The public pilot remains intentionally credential-less.

## Rollback

Return to `v0.10.0-estimeter-workspace`. No migration or user data rollback is required.

## Next action

Request user review of the interactive workspace. After approval, scope a separate data-backed release for project records, drawing uploads, auditable AI take-off evidence, price-set selection and export approval enforcement.
