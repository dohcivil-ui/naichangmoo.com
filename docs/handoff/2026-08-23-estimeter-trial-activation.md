# Handoff — 2026-08-23 — ESTIMETR Trial Starts at Explicit Activation (v0.16.0)

## Description

แยกด่านสมาชิกเว็บออกจากด่านสิทธิ์ทดลองใช้แอป นาฬิกา ESTIMETR 5 วันเริ่มนับเมื่อสมาชิกกดเริ่มทดลองใช้อย่างชัดแจ้งหลังเห็นเงื่อนไข ไม่ใช่เมื่อสมัครสมาชิก การอ่านสิทธิ์ไม่เขียนฐานข้อมูล ADR 0006 supersede จุดเริ่มนาฬิกาใน ADR 0003 ส่วนเงื่อนไข 5 วัน / 1 โครงการ / ปิด export-print / read-only หลังหมดอายุยังใช้ตามเดิม

## Changed Scope

| Area | Files | Summary |
|---|---|---|
| Policy | `docs/adr/0006-trial-clock-starts-at-explicit-activation.md`, `docs/adr/0003-platform-membership-entitlement-and-trial.md` | ADR 0006 กำหนดจุดเริ่มนาฬิกาใหม่; ADR 0003 ยังใช้เงื่อนไขอื่น |
| Access | `src/server/estimeter-access.ts`, `src/lib/estimeter-trial.ts`, `src/lib/entitlement.ts` | แยก `ensurePersonalOrganization` / `activateEstimeterTrial`; GET เป็น read path; สถานะคำนวณ `not_activated` |
| Action / UI | `src/server/actions/estimeter-trial.ts`, `src/components/estimeter/trial-activation.tsx`, `src/app/apps/estimeter/page.tsx` | แสดงเงื่อนไขแล้วให้กดเริ่ม; บันทึก `entitlement.trial_activated` |
| Write gates | `src/lib/estimeter-project.ts`, `src/server/actions/estimeter-project.ts`, `src/server/actions/estimeter-takeoff.ts` | สร้างโครงการและถอดปริมาณไม่ได้จนกว่าจะกดเริ่ม |
| Tests | `src/lib/entitlement.test.ts`, `src/lib/estimeter-trial.test.ts`, `src/lib/estimeter-project.test.ts`, `src/server/estimeter-access.integration.test.ts` | นาฬิกาเริ่มที่เวลาที่กด; GET ไม่เขียน DB; กดซ้ำไม่ต่อเวลา |
| Governance | `docs/roadmap/roadmap.v0.16.0.json`, `roadmap.json`, `CHANGELOG.md`, `docs/handoff/index.json`, `package.json` | v0.16.0; ยกเลิก IP-040 |

ไม่มี migration ใช้ตารางเดิมจาก 0000+0001

## Verification

- `pnpm typecheck`, `pnpm lint` (0 warnings), `pnpm build`, `pnpm security:check` ผ่าน
- `pnpm test`: 79 passed / 21 skipped
- `ESTIMETR_DB_TESTS=1 pnpm test`: **19 files / 100 tests ผ่านหมด** รวมเคส GET ไม่เขียน DB, นาฬิกาเริ่มที่เวลาที่กด, กดซ้ำไม่ต่อเวลา, activate พร้อมกันได้แถวเดียว

## Security and data impact

- การเปิดหน้า ESTIMETR ไม่สร้าง entitlement อีกต่อไป จึงไม่มีนาฬิกาที่เริ่มโดยไม่ได้รับความยินยอม
- audit บันทึกว่าใครยอมรับเงื่อนไขเมื่อไร (`acceptedTerms`, `startedBy: explicit_activation`)
- ไม่แตะ `.env` หรือข้อมูลลูกค้าจริง ฐานข้อมูลเป็น dev ล้วน
- แถว entitlement ที่ออกด้วยนาฬิกาแบบเก่า (v0.13.0) ยังถูกอ่านเป็น trial ตามวันที่เดิม จนกว่าจะลบออก ถ้าต้องเคลียร์เครื่อง local:

```sql
DELETE FROM app_entitlements;
```

องค์กรและโครงการเดิมยังอยู่ สมาชิกจะกลับไปสถานะ `not_activated` แล้วกดเริ่มใหม่ได้

## Rollback

กลับไป tag `v0.15.0-estimeter-manual-takeoff` หรือ revert commit ของ v0.16.0 ไม่มี migration ให้ย้อน

## Next action

Push และ tag v0.16.0 เสร็จแล้ว PR #6 CI เขียว ดู handoff ต่อ VS Code: `docs/handoff/2026-08-23-vscode-continuation-estimeter.md`
