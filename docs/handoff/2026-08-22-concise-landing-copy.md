# Handoff — `v0.12.1: Concise Landing Copy and In-App Trial Details`

## Description

This release responds to direct user review of the Marketplace Landing. The public page now presents only the minimum information needed to identify an app and begin: brief hero copy, category headings, app cards, status and a five-day trial message. It no longer presents internal trial capabilities, AI Takeoff/BOQ permission states, technical preview status or verbose policy language. Those details now live in ESTIMETR, where a user needs them to understand how the application works.

## Changed Scope

| Area | Files | Summary |
|---|---|---|
| Landing public copy | `src/app/page.tsx`, `src/components/landing/sign-in-button.tsx` | Removes Market wording, the public entitlement preview, detailed Hermes policy copy and technical preview notice. |
| Catalog wording | `src/lib/platform.ts`, `src/components/landing/app-card.tsx`, `src/lib/platform.test.ts` | Renames the first category to หมวดประมาณราคา, changes the public label to ฟรี ทดลองใช้งาน 5 วัน and shortens public descriptions. |
| ESTIMETR only | `src/components/estimeter/estimation-workspace.tsx`, `src/components/landing/trial-policy-preview.tsx` | Moves the trial entitlement panel inside the ESTIMETR workspace and renames its heading for in-app use. |
| App detail | `src/app/market/[slug]/page.tsx` | Uses concise pre-entry copy and the approved trial wording. |

## Verification

Local Landing review confirms the circled explanatory paragraph and the public trial/AI/BOQ preview were removed, the land category says ภารกิจจัดกรรมสิทธิ์ที่ดิน กรมทางหลวง, and visible trial messaging reads ฟรี ทดลองใช้งาน 5 วัน. ESTIMETR review confirms entitlement details are visible only inside the app. Lint, 5 Vitest files / 13 tests, TypeScript, credential-less production build, security preflight, roadmap validation and diff hygiene pass. GitHub push and private preview validation remain pending.

## Security and data impact

No database migration, entitlement logic, payment, real price source, document baseline, AI endpoint or export artifact was added. This is a copy placement and public-disclosure boundary refinement only.

## Rollback

Return to `v0.12.0-civil-apps-market`. No data rollback is required.

## Next action

Push the versioned release, verify the private Vercel preview and request the user’s visual review before making any further Landing content expansion.
