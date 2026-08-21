# ADR 0001: Portable pilot and production deployment

**Status:** Accepted

## Context

ทีมต้องการทดลองระบบบน Vercel เพื่อรับ feedback/deploy ได้เร็ว แต่ production ต้องย้ายไป Hostinger VPS เพราะต้องรองรับ Hermes Agent แบบ 24/7, background worker, queue และ runtime ที่ควบคุมได้ ทั้งสองเป้าหมายต้องใช้ source เดียวกันโดยไม่ผูก business logic กับ provider.

## Decision

ใช้ Next.js App Router และ Route Handlers ที่รันได้ทั้ง Vercel และ Node.js standalone container. ใช้ PostgreSQL, Redis-compatible queue และ Cloudflare R2 ผ่าน provider-neutral interfaces. Vercel ใช้เฉพาะ pilot environment; Hostinger VPS เป็น production target.

## Alternatives considered

| Alternative | Why not selected now |
|---|---|
| ใช้ Vercel เป็น production ถาวร | background agent/runtime แบบ 24/7 และงาน PDF/AI queue ต้องพึ่งข้อจำกัดของ serverless มากเกินไป |
| ใช้ Hostinger VPS ตั้งแต่ development | ทำให้ preview/feedback ช้าขึ้นและเพิ่ม operational burden ก่อนพิสูจน์ product |
| เขียน cloud-specific integrations ตรงใน domain code | ทำให้ migration อนาคตมีความเสี่ยงและทดสอบยาก |

## Consequences

ต้องมี adapter boundary สำหรับ storage, queue, email/notification และ deployment config. Production ต้องมี Docker Compose/containers, health checks, backup, observability และ VPS hardening. ไม่ deploy Hermes หรือ Postgres บน Vercel.
