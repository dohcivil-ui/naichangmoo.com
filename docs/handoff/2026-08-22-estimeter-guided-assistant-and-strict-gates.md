# Handoff — `v0.11.0: ESTIMETR Guided Assistant and Strict Release Gates`

## Description

ESTIMETR now includes a deterministic, contextual Guided AI Assistant that teaches beginners step by step and lets experienced users collapse the explanation or switch to Fast mode. The workspace no longer treats its four stages as simple navigation: project path, drawing revision/scale, take-off evidence, price-set approval and unit-cost review are explicit prerequisites. The release deliberately remains a non-persistent demo and cannot create real prices, standards-compliant forms, Excel or PDF output.

## Changed Scope

| Area | Files | Summary |
|---|---|---|
| Guided workspace | `src/components/estimeter/estimation-workspace.tsx`, `src/app/globals.css` | Adds a private/government path choice, scale confirmation, explicit locked actions, price-set gate, contextual assistant panel and locked document-release state. |
| Workflow contract | `src/lib/estimation-workflow.ts`, `src/lib/estimation-workflow.test.ts` | Adds pure state resolution and human-readable blockers for all prerequisites; test count rises to 11. |
| Product policy | `docs/architecture/estimeter-operating-policy.md`, `docs/requirements/estimeter-guided-ai-assistant.md` | Records evidence-to-export provenance, AI authority boundary, release requirements and backend milestones. |
| Research/verification | `docs/research/*`, `docs/verification/estimeter-guided-assistant-validation-2026-08-22.md` | Records authorized workflow observations, government source discovery and desktop/mobile validation. |
| Repository hardening | `.github/workflows/quality.yml`, `docs/security/source-and-ai-boundary-review-2026-08-22.md` | Adds read-only SHA-pinned CI and records the private repository/Dependabot baseline; protected branches remain pending the GitHub plan upgrade approved by the user. |

## Verification

`pnpm lint`, `pnpm test` (4 files / 11 tests), `pnpm typecheck`, credential-less `DEPLOY_TARGET=vercel NODE_ENV=production pnpm build`, `pnpm security:check`, `node scripts/check-roadmap.mjs` and `git diff --check` pass. Visual inspection at 1440 × 1400 and 375 × 1200 confirms the guided panel, explicit disabled gate state and responsive horizontal stage rail.

## Security and data impact

The repository has been made private and GitHub Actions is restricted to GitHub-owned, SHA-pinned actions. Dependabot security updates are enabled. This release has no schema migration, user data, drawing upload, price ingestion, LLM request, payment behavior, secret, approved document baseline or export artifact. Branch protection is not configured because the current GitHub plan blocks it for this private repository; it is a known hardening follow-up.

## Rollback

Return to `v0.10.2-estimeter-github-confirmed`. No migration or user-data rollback is required.

## Next action

After public UI review, implement server-side project/drawing state, authoritative TPSO/approved labor price ingestion, document baseline registry, arithmetic/rounding/Factor F validation fixtures and approved Excel/PDF artifact generation. Do not mark any output standards-compliant before that work passes its own release gates.
