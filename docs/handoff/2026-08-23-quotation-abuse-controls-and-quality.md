# Handoff — Quotation Abuse Controls, Quality Hardening & Local DB Setup (session)

> สถานะ: **work in progress / uncommitted** บน branch `fix/quotation-intake-abuse-controls`
> ใช้เอกสารนี้เปิดแชทใหม่แล้วทำงานต่อได้ทันที

## Description

ปิดช่องโหว่และเก็บงานคุณภาพจากผลรีวิว source code ของ `naichangmoo.com`: เพิ่ม abuse controls ให้ public quotation intake (rate limit + honeypot + hashed IP), แก้ค่า entitlement expiry, กัน StatusConsole พัง, map `procurementNote`, เพิ่มเทสต์ และใส่ server-side auth guard ให้ `/apps/[slug]`. **Local PostgreSQL, `.env` และ migration `0000`+`0001` เสร็จแล้ว.**

## สถานะ repo ปัจจุบัน

- **Branch:** `fix/quotation-intake-abuse-controls` (แตกจาก `initial-project/nextjs-foundation`)
- **ยังไม่ commit** — โค้ดทั้งหมดเป็น working-tree changes
- **Toolchain:** ติดตั้ง `pnpm@10.20.0` แบบ global แล้ว (`npm i -g pnpm`, อยู่ที่ `C:\Users\moosu\AppData\Roaming\npm`) → ใช้ `pnpm ...` ได้ตรงๆ; `node_modules` ติดตั้งแล้ว
- **Repo อยู่ที่ root:** `D:\AIProject\naichangmoo` (git history + remote `origin` = `dohcivil-ui/naichangmoo.com` ครบ)

## Changed Scope (uncommitted)

| Area | Files | Summary |
|---|---|---|
| Quotation abuse controls | `src/server/actions/enterprise-quotation.ts`, `src/server/actions/quotation-schema.ts` (new), `src/server/rate-limit.ts` (new), `src/server/request-identity.ts` (new) | honeypot → rate limit (5/IP/hr, DB fixed-window) → validate → insert; แยก pure logic ออกจากไฟล์ `"use server"` เพื่อเทสต์ |
| Data model | `src/db/schema.ts`, `drizzle/0001_red_patch.sql` (new), `drizzle/meta/*` | เพิ่มตาราง `rate_limit_counters` + คอลัมน์ `enterprise_quotation_requests.ip_hash` |
| Form UX | `src/components/landing/enterprise-quote-form.tsx`, `src/app/globals.css` | `useActionState` + inline success/error, honeypot field, ช่อง `procurementNote` |
| Entitlement | `src/lib/entitlement.ts`, `src/lib/entitlement.test.ts` | `resolveEntitlement` ให้ state `active` หมดอายุเป็น `expired_read_only` ด้วย (ไม่ใช่แค่ `trial`) |
| Robustness | `src/components/project-status/status-console.tsx` | guard เมื่อ `handoffs` ว่าง (`.at(0)` + empty state) |
| Auth guard | `src/app/apps/[slug]/page.tsx` | server-side `auth.api.getSession`: ยังไม่ล็อกอิน → เชิญ sign-in, `doh_staff_only` → หน้าจำกัดสิทธิ์ |
| Tests | `src/server/actions/quotation-schema.test.ts` (new), `src/server/project-status.test.ts` (new), `src/server/rate-limit.test.ts` (new) | 4 → 16 tests |
| Lint fix | `postcss.config.mjs` | assign เป็น `const config` ก่อน export (warning หาย) |
| Env | `.env.example` | เพิ่ม `RATE_LIMIT_SALT` (fallback = `BETTER_AUTH_SECRET`) |

## Verification (ทำแล้ว ผ่านหมด)

| Check | Result |
|---|---|
| `pnpm typecheck` | Passed |
| `pnpm lint` | Passed — **0 warnings** |
| `pnpm test` | Passed — **16 tests / 5 files** |
| `pnpm build` (DATABASE_URL + BETTER_AUTH_* set) | Passed; `/` static, `/apps/[slug]` dynamic |
| `pnpm db:generate` | Passed — `drizzle/0001_red_patch.sql` |

## Security and data impact

- ปิด spam risk ของ public server action (เดิมไม่มี rate limit/bot protection)
- เก็บ IP เป็น **salted sha256** เท่านั้น ไม่เก็บ IP ดิบ
- Migration `0000` + `0001` **ถูก apply เข้า DB `naichangmoo` แล้ว** (มี `rate_limit_counters` และคอลัมน์ `ip_hash`)
- `.env` ถูกสร้างแล้ว (gitignore) มี `DATABASE_URL`, `BETTER_AUTH_SECRET`, `RATE_LIMIT_SALT` — ห้าม commit / ห้ามพิมพ์ค่า
- `pg_hba.conf` คืนค่าเป็น `scram-sha-256` แล้ว (บรรทัด `trust` ชั่วคราวถูกลบ, backup ถูกลบหลังยืนยันแล้ว)

## Local PostgreSQL — เสร็จแล้ว (2026-08-23)

- Service `postgresql-x64-18` รันที่พอร์ต `5432`
- Database `naichangmoo` สร้างแล้ว, login ด้วย user `postgres` + scram ผ่านแล้ว
- `pnpm db:migrate` สำเร็จ — 23 ตารางใน schema `public`

## Next action

1. `pnpm dev` แล้วทดสอบ Landing + ส่ง quotation form (rate limit / honeypot / ข้อความสำเร็จ-ผิดพลาด)
2. เมื่อพร้อม commit: bump roadmap เป็น `v0.4.0` → commit → handoff ฉบับ final → tag (รอผู้ใช้สั่ง)

## Governance ที่ยังไม่ได้ทำ (ตาม AGENTS.md — ให้ผู้ใช้อนุมัติก่อน)

ยังไม่ commit ให้เพราะ workflow กำหนดให้ bump `docs/roadmap/roadmap.json` เป็นเวอร์ชันใหม่ (แนะนำ `v0.4.0` — "Public intake abuse controls & quality hardening") ก่อน commit, เขียน handoff ฉบับ final (เพิ่มลง `docs/handoff/index.json`) หลัง commit, แล้วสร้าง annotated tag. รอผู้ใช้สั่งเมื่อพร้อม commit/push
