# Handoff — v0.4.1: Vercel Auth-Safe Pilot Build

## Description

แก้ build error ของ Vercel pilot ที่เกิดจาก Better Auth เรียก database adapter ระหว่าง Next.js build ทั้งที่ preview ยังไม่มี `DATABASE_URL`. Preview จึง build และ render Landing/app shell ได้โดยไม่ใช้ database หรือ OAuth credential ขณะที่ production auth ยังคงเปิดได้เมื่อ environment พร้อม.

## Root Cause

`src/app/api/auth/[...all]/route.ts` import `auth` แบบ eager. `src/lib/auth.ts` สร้าง `drizzleAdapter(getDb())` ที่ module load ทำให้ `getDb()` throw เมื่อ Vercel build ไม่มี `DATABASE_URL`.

## Changed Scope

| Area | Files | Summary |
|---|---|---|
| Auth configuration guard | `src/lib/auth-availability.ts`, `src/lib/auth-availability.test.ts` | เพิ่ม pure guard ตรวจว่ามี database URL, Better Auth secret และ base URL ครบก่อนเริ่ม auth runtime |
| Auth route | `src/app/api/auth/[...all]/route.ts` | เปลี่ยนเป็น dynamic import เมื่อ runtime พร้อม; preview ที่ไม่พร้อมตอบ 503 แบบอธิบายได้ |
| Landing login behavior | `src/components/landing/sign-in-button.tsx`, `src/app/globals.css` | เพิ่ม safe preview state; ปุ่มแจ้งว่า OAuth จะเปิดเมื่อ infrastructure พร้อม แทนการส่ง user ไป auth endpoint ที่ใช้ไม่ได้ |
| Environment contract | `.env.example` | เพิ่ม `NEXT_PUBLIC_AUTH_ENABLED=false` เพื่อแยก review mode ออกจาก production auth |
| Version record | `docs/roadmap/roadmap.v0.4.1.json`, `docs/roadmap/roadmap.json`, `docs/roadmap/CHANGELOG.md` | บันทึก scope, verification, constraint และ rollback ของ bugfix |

## Verification

| Check | Result |
|---|---|
| Missing environment build | `pnpm lint`, `pnpm test`, `pnpm typecheck` และ `NODE_ENV=production pnpm build` ผ่านโดย unset DB/auth env |
| Unit tests | 6 tests passed, including preview auth availability tests |
| Security | `pnpm security:check` ผ่าน |
| Roadmap | `node scripts/check-roadmap.mjs` ตรวจ roadmap v0.4.1 ผ่าน |
| Pending | Push commit, Vercel deploy และ public route verification |

## Deployment Contract

Pilot preview requires no database, OAuth, Stripe, Redis หรือ Hermes credential. Do **not** set `NEXT_PUBLIC_AUTH_ENABLED=true` until PostgreSQL, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` and at least one OAuth provider configuration are all configured.

## Rollback

Return to tag `v0.4.0-unified-app-shell`. This reintroduces the eager-auth behavior and should only be used in an environment that already has database credentials during the build process.

## Next Action

Commit and push `v0.4.1`, let Vercel create a deployment from the linked source repository, then verify Landing, `/apps/estimeter`, `/apps/rcopt`, `/roadmap`, and `/api/auth/*` preview behavior from the public deployment URL.
