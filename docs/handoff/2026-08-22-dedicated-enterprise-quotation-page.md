# Handoff — v0.8.0: Dedicated Enterprise Quotation Page

## Description

Moves the enterprise quotation intake from Landing to a dedicated `/enterprise` route. This reduces Landing density and preserves its role as an app registry and platform overview.

## Changed Scope

| Area | File | Summary |
|---|---|---|
| Dedicated page | `src/app/enterprise/page.tsx` | Adds organization/agency explanatory content, existing quote form and shared platform chrome |
| Landing simplification | `src/app/page.tsx` | Removes inline quotation section, `QuoteIcon` and form import |
| Navigation flow | `src/components/platform/platform-nav.tsx` | Routes primary quote pill to `/enterprise`, gives it route-aware active state and removes non-existent anchor from observer |
| Responsive anchors | `src/app/globals.css` | Limits Landing scroll offset rules to sections that remain on Landing |

## Verification

Lint, six unit tests and typecheck pass. Final production build, security preflight, roadmap validation and public route review remain required before release.

## Rollback

Return to tag `v0.7.1-light-teal-active` to restore the inline enterprise quotation form on Landing. No database migration or user data change is involved.

## Next Action

Complete quality gate, deploy to Vercel, verify `/`, `/enterprise` and `/roadmap`, then provide the updated public links.
