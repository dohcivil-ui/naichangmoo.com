# Handoff — `v0.12.2: Landing Interaction Contracts and Button Audit`

## Description

The Landing now has a tested interaction contract rather than independent route strings scattered across components. The contract covers brand/home, primary navigation, hero catalog action, app-card details, available-app entry, locked-app behavior, footer Roadmap action and Login behavior. A manual audit also exercised every public Landing interaction without submitting a real organization quotation request.

## Changed Scope

| Area | Files | Summary |
|---|---|---|
| Interaction contract | `src/lib/landing-interactions.ts`, `src/lib/landing-interactions.test.ts` | Defines allowed navigation, app-detail/entry gates and Login modes; adds 3 regression tests. |
| Landing consumers | `PlatformNav`, `LandingPage`, `AppCard`, `MarketAppDetailPage`, `PlatformFooter`, `SignInButton` | Uses the shared contract instead of duplicating routes/readiness decisions. |
| Verification | `docs/verification/landing-interaction-audit-2026-08-22.md` | Records manual click results and explains the preview Login boundary. |

## Verification

Manual checks passed for the brand return action, apps anchor, Hermes anchor, Roadmap navigation and refresh, enterprise navigation/form availability, preview Login feedback, all four app details, ESTIMETR entry and coming-soon/restricted locks. The organization form was not submitted because that would create a real external request. Lint, 6 Vitest files / 16 tests, TypeScript, credential-less production build, security preflight, roadmap validation and diff hygiene pass.

## Security and data impact

No real Login has been enabled in the Vercel pilot. In a credential-less preview, the Login button deliberately shows an accessible preparation status rather than initiating an invalid sign-in. In a configured environment, its tested contract invokes Google sign-in and returns to ESTIMETR. No migration, payment, real price source, customer data or export artifact changed.

## Rollback

Return to `v0.12.1-concise-landing`. No data rollback is required.

## Next action

Verify the private Vercel preview for v0.12.2. Before enabling production login, supply database/auth/OAuth configuration and complete an authenticated end-to-end test in a separate release.
