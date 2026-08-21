# Handoff — v0.3.0: Interactive Landing and Source Status Console

## Description

ส่งมอบ full editable Next.js source scaffold รุ่นแรกของนายช่างหมู พร้อม Landing HTML mockup แบบโต้ตอบได้, app registry, Hermes pilot disclosure, enterprise quotation intake และ Roadmap/Handoff HTML console ที่อ่าน metadata จาก source files.

## Changed Scope

| Area | Files | Summary |
|---|---|---|
| Application scaffold | `package.json`, `src/app/*`, `src/lib/*` | Next.js App Router, TypeScript, Tailwind, lint/test/build scripts และ standalone output |
| Access policy | `src/lib/entitlement.*` | ESTIMETR trial 5 วัน/1 โครงการ, export/print lock และ read-only retention policy พร้อม tests |
| Platform Landing | `src/app/page.tsx`, `src/components/landing/*`, `src/components/icons/*` | app cards แยกตาม entitlement, SVG icons, Hermes 24/7 disclosure, quotation intake และ entitlement interaction preview |
| Data model | `src/db/*`, `drizzle/0000_short_maginty.sql` | PostgreSQL/Drizzle initial schema และ migration สำหรับ identity, entitlement, project, evidence, price, job/audit |
| Hermes pilot | `src/server/hermes/*` | typed takeoff evidence review boundary, denial policy และ tests |
| Source status UI | `src/app/roadmap/*`, `src/app/api/project-status/*`, `docs/roadmap/*`, `docs/handoff/index.json` | Roadmap/Handoff console refresh runtime จาก version metadata ที่ source-control |
| Dev proxy | `next.config.ts` | `NEXT_ALLOWED_DEV_ORIGIN` สำหรับ mockup client interaction ผ่าน dev proxy |

## Verification

| Check | Result |
|---|---|
| `pnpm lint` | Passed after navigation rule fix |
| `pnpm test` | Passed: 4 tests across entitlement and Hermes policy |
| `pnpm typecheck` | Passed |
| `NODE_ENV=production pnpm build` | Passed; routes `/`, `/roadmap`, `/apps/[slug]`, `/api/auth/[...all]`, `/api/project-status` generated |
| `pnpm db:generate` | Passed; generated `drizzle/0000_short_maginty.sql` |
| Browser verification | Landing, app cards, Hermes section, quote intake, entitlement state transition and Roadmap/Handoff tabs verified |

## Security and Data Impact

No real credentials, PostgreSQL database, R2 bucket, Stripe event, OAuth provider, customer data or Hermes runtime was provisioned. `.env.example` only contains placeholder keys. Hermes source policy denies database write, price change, document release, external message, payment action and infrastructure change.

## Rollback

Return to tag `v0.2.0-architecture` to remove the source scaffold. The initial migration exists only as a source SQL file and has not been applied to a database.

## Next Action

Present the Landing mockup for user review. After acceptance, build individual HTML mockups in this order: ESTIMETR, RCOPT, Traffic Sign, then controlled Land Acquisition access screen. Create a new roadmap version, handoff, tag and GitHub push for each accepted milestone.
