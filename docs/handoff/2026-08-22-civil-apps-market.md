# Handoff — `v0.12.0: Civil Apps Market and App Detail Routes`

## Description

The platform Landing now functions as a Civil Apps Market rather than a generic app registry. The visitor sees every approved work category followed immediately by its matching application card—without a filter, launcher or extra discovery step. Each application opens a pre-entry detail route that explains the work outcome, preparation, guided flow, access status and real availability before any workspace route is shown.

## Changed Scope

| Area | Files | Summary |
|---|---|---|
| Market registry | `src/lib/platform.ts` | Adds four approved category identifiers, truthful app detail content and availability labels to the existing four-app portfolio. |
| Landing catalog | `src/app/page.tsx`, `src/components/landing/app-card.tsx`, `src/app/globals.css` | Groups and renders each app card directly beneath its category: ประมาณราคางานอาคาร, หมวดงานออกแบบวิศวกรรมโยธา, หมวดงานอุปกรณ์อำนวยความปลอดภัย and หมวดงานสำนักจัดกรรมสิทธิ์ที่ดิน. |
| Pre-entry app detail | `src/app/market/[slug]/page.tsx` | Adds dedicated app explanation before workspace entry. ESTIMETR may proceed to its current workspace; coming-soon/restricted apps are explicitly withheld. |
| Navigation and tests | `src/components/platform/platform-nav.tsx`, `src/lib/platform.test.ts` | Keeps the market navigation state-aware and validates category mapping/detail data for all four apps. |
| Documentation | Requirements and validation records | Captures the user-approved information architecture and browser/visual review results. |

## Verification

Lint, 5 Vitest files / 13 tests, TypeScript typecheck, credential-less Vercel production build, security preflight, roadmap validation and diff hygiene pass. Local desktop and mobile Landing review confirms the direct category-to-card flow. Local browser review confirms ESTIMETR card → detail → workspace entry and confirms the Retaining Wall detail does not expose an unready workspace. GitHub push and Vercel private preview review remain release-gate tasks.

## Security and data impact

No database migration, authentication rule, entitlement rule, payment price, real price source, customer data, drawing, AI endpoint or export document changes. The market does not show numeric commercial pricing and does not claim that current pilot UI has certified price/export capability.

## Rollback

Return to `v0.11.2-vercel-private-preview-verified`. No data rollback is required.

## Next action

Complete the full release quality gate and publish the private preview. After visual approval, connect detail-page actions to real membership/checkout only when the commercial package and server-side entitlement behavior are approved.
