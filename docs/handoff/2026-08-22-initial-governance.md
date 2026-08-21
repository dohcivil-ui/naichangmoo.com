# Handoff — Initial Project Governance v0.1.0

## Purpose

สร้าง source-of-truth และกติกาการทำงานของ repository `naichangmoo.com` ก่อนเริ่มเขียน architecture หรือ application source เพื่อให้ผู้พัฒนาและ AI ตัวถัดไปรับช่วงงานได้โดยไม่ต้องเดาเจตนาของ product.

## Changed

| Area | Files | Summary |
|---|---|---|
| Project memory | `CONTEXT.md`, `PROJECT.md`, `AGENTS.md` | กำหนด vocabulary, portfolio, entitlement, design rule, source-of-truth และ safety boundary |
| Governance | `docs/rules/engineering.md`, `.agent/commands/adr.md` | กำหนด branch-first, ADR, migration, entitlement และ Hermes rules |
| Roadmap | `docs/roadmap/*` | สร้าง roadmap JSON versioned `v0.1.0`, changelog และ pre-commit pointer validation |
| Git handoff | `hooks/pre-commit`, `scripts/*`, `docs/handoff/HANDOFF_TEMPLATE.md` | เพิ่ม hook setup และ template สำหรับทุก commit ถัดไป |
| Hermes research | `docs/research/hermes-agent-runtime-assessment.md` | บันทึก deployment options และ guardrails ของ Hermes pilot |

## Verified

`node scripts/check-roadmap.mjs` ต้องผ่านก่อน commit นี้ หลัง scaffold application จะเพิ่ม `lint`, `test` และ `typecheck` เข้า pre-commit quality gate โดยอัตโนมัติผ่าน `hooks/pre-commit`.

## Security and data impact

ไม่มี credential, customer data, OAuth provider secret, Stripe secret, drawing file หรือ production integration ถูกสร้างหรือ commit. Hermes ถูกจำกัดเชิง policy ให้รับ typed review job และไม่มี direct database/Stripe/infrastructure access.

## Rollback

ย้อนกลับได้ด้วย annotated tag `v0.1.0-initial-governance` หลัง commit เสร็จ ไม่มี migration หรือ infrastructure state ที่ต้องย้อนกลับ.

## Next action

ดำเนิน `IP-003`: สร้าง ADR สำหรับ deployment portability, PostgreSQL/Drizzle, entitlement lifecycle, Cloudflare R2, Hermes queue boundary และ enterprise quotation intake ก่อน scaffold source code.
