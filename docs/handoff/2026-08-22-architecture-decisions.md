# Handoff — Architecture Decisions v0.2.0

## Purpose

กำหนด baseline architecture และ logical PostgreSQL data model ของ Initial Project ใหม่ โดยไม่ reuse prototype schema/source เดิม และปิด decision สำคัญก่อน scaffold application.

## Changed

| Area | Files | Summary |
|---|---|---|
| Architecture | `docs/architecture/ARCHITECTURE.md` | กำหนด Next.js/Vercel pilot, Hostinger VPS production, Postgres, R2, queue และ Hermes topology |
| Data model | `docs/architecture/DATA_MODEL.md` | นิยาม logical tables สำหรับ Better Auth, organization, entitlement, ESTIMETR, price/revision, intake, jobs และ audit |
| ADR | `docs/adr/0001` ถึง `0005` | บันทึก deployment portability, database boundary, trial, Hermes pilot และ B2B intake |
| Roadmap | `docs/roadmap/roadmap.v0.2.0.json`, `roadmap.json`, `CHANGELOG.md` | ยกระดับ roadmap pointer เป็น v0.2.0 ก่อน commit |

## Verified

ตรวจ syntax JSON ผ่าน `node scripts/check-roadmap.mjs`. ต้องตรวจ schema/route/typecheck เพิ่มเมื่อเริ่ม scaffold Next.js ใน IP-004.

## Security and data impact

ไม่มี database, credential, payment action, OAuth provider หรือ Hermes runtime ถูกเปิดใช้. ADR 0004 บังคับ Hermes pilot เป็น advisory review worker แบบ isolated ไม่มี direct database/Stripe/infrastructure access.

## Rollback

ย้อนกลับได้ด้วย tag `v0.1.0-initial-governance` หรือ revert commit architecture นี้ ไม่มี migration/production data เปลี่ยนแปลง.

## Next action

ดำเนิน IP-004: bootstrap Next.js App Router, TypeScript, Tailwind, Drizzle and test harness โดยยังไม่ต่อ real secret, real database หรือ production provider.
