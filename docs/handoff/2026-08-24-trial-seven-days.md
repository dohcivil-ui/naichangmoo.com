# Handoff — `v0.26.0: A Seven-Day Trial That Does Not Lead With Its Limit`

ข้าม `/grill-with-docs` ตาม AGENTS.md ข้อ 1 เพราะเจ้าของงานตัดสินใจเรื่องนโยบายมาแล้วโดยตรง และคำถามเดียวที่กำกวมจริง — คำว่า "ไม่ต้องบอก 1 โครงการ" หมายถึงเลิกบังคับใช้หรือเลิกพูดถึง — ถูกถามและตอบก่อนแตะโค้ด คำตอบคือเลิกพูดถึงในข้อความพาดหัว แต่ยังบังคับใช้ ซึ่งบันทึกไว้ใน ADR 0009 แล้ว

## Description

สิทธิ์ทดลองใช้ ESTIMETR เปลี่ยนจาก 5 วันเป็น 7 วัน และเพดาน 1 โครงการถูกถอดออกจากข้อความพาดหัวโดยที่การบังคับใช้ไม่เปลี่ยน ADR 0009 เป็นตัว supersede เงื่อนไข 5 วันที่ ADR 0003 ตั้งไว้และ ADR 0006 ยืนยันซ้ำ เส้นแบ่งที่ ADR นี้วางไว้คือ **พาดหัวกับรายละเอียด** ไม่ใช่ก่อนเข้ากับหลังเข้า พาดหัวไม่นำเสนอข้อจำกัด รายละเอียดบอกครบ

## Changed Scope

| Area | Files | Summary |
|---|---|---|
| ADR | `docs/adr/0009-trial-runs-seven-days-and-stops-advertising-the-project-limit.md` | ADR ใหม่ พร้อมตารางว่าจุดไหนพูดถึงเพดานและจุดไหนไม่พูด และเหตุผลของแต่ละจุด |
| นโยบายที่บังคับใช้ | `src/lib/estimeter-trial.ts` | `ESTIMETR_TRIAL_DAYS` 5 → 7 พร้อมคอมเมนต์ที่อ้าง ADR 0009 `ESTIMETR_TRIAL_LIMITS.projectLimit` **ยังเป็น 1** |
| นโยบายที่บังคับใช้ | `src/lib/entitlement.ts` | คอมเมนต์เท่านั้น `STATE_POLICY.trial.projectLimit` **ยังเป็น 1** ไม่มีการเปลี่ยนพฤติกรรม |
| ข้อความพาดหัว | `src/lib/platform.ts`, `src/app/page.tsx`, `src/app/market/[slug]/page.tsx` | `accessLabel.paid_trial` เป็น `"ฟรี ทดลองใช้งาน 7 วัน"` ตัด `· 1 โครงการ` ออก; hero และปุ่มเข้าใช้เป็น 7 วัน |
| รายละเอียดที่ยังบอกครบ | `src/lib/platform.ts`, `src/components/estimeter/trial-activation.tsx` | `marketDetail.availabilityNote` เป็น `"ทดลองใช้ได้ 7 วัน 1 โครงการ โดยปิดการส่งออกและพิมพ์"`; หน้าจอกดเริ่มยังลิสต์เพดาน โดยเพิ่มคอมเมนต์อธิบายว่าทำไมมันต้องอยู่ที่นี่ |
| Server comment | `src/server/estimeter-access.ts` | คอมเมนต์ Gate 2 เป็น seven-day clock |
| Tests | `src/lib/estimeter-trial.test.ts`, `src/lib/entitlement.test.ts`, `src/lib/platform.test.ts`, `src/server/estimeter-access.integration.test.ts` | ปรับวันที่และชื่อเทสต์ให้ตรงนโยบาย เพิ่ม assertion ว่า `accessLabel.paid_trial` **ไม่มีคำว่า** `โครงการ` |
| Requirements | `docs/requirements/civil-apps-market.md` | ข้อความเชิงพาณิชย์ที่อนุมัติเป็น `ทดลองใช้ฟรี 7 วัน` และระบุว่าเพดานยังบอกที่รายละเอียด |
| Roadmap | `docs/roadmap/roadmap.v0.26.0.json`, `docs/roadmap/roadmap.json`, `docs/roadmap/CHANGELOG.md`, `package.json` | เวอร์ชัน 0.26.0 |

## Verification

| คำสั่ง | ผล |
|---|---|
| `pnpm test` | 168 passed, 33 skipped |
| `pnpm typecheck` | ผ่าน |
| `pnpm lint` | 0 error, 1 warning ที่มีอยู่ก่อนแล้ว (`formatSatang` ใน `thai-baht.test.ts`) |
| `node scripts/check-roadmap.mjs` | `Roadmap 0.26.0 is valid (15 item(s)) and matches roadmap.v0.26.0.json` |

ตัวเลขที่เทสต์ยืนยันหลังเปลี่ยน:

- กดเริ่ม `2026-08-23T09:15Z` → หมดอายุ `2026-08-30T09:15Z` (เดิม `08-28`)
- กดเริ่ม `2026-08-20T10:00Z` → หมดอายุ `2026-08-27T10:00Z`, `daysRemaining` ที่ `08-21T10:00Z` เป็น 6 (เดิม `08-25` และ 4)
- `accessLabel.paid_trial` เท่ากับ `"ฟรี ทดลองใช้งาน 7 วัน"` และ `not.toContain("โครงการ")`

ตรวจด้วย `grep` ว่าไม่เหลือ `5 วัน` หรือ `five-day` ใน `src/` และ `docs/requirements/` นอกจากประโยคที่อ้างอิงประวัติใน ADR และตารางข้อกำหนดโดยเจตนา

## Security and data impact

ไม่มีการเปลี่ยนสิทธิ์ ความลับ PII การชำระเงิน หรือ migration การบังคับใช้เพดานโครงการยังอยู่ฝั่งเซิร์ฟเวอร์ที่ `STATE_POLICY.trial` และ `ESTIMETR_TRIAL_LIMITS` ตามหลัก prefer server-side authorization checks over hiding UI controls สิ่งที่เปลี่ยนคือข้อความ ไม่ใช่การบังคับใช้ — และมี assertion ในเทสต์ที่จับไว้ว่าเพดานยังทำงาน (`canCreateAnotherProject(trial, 1, now)` เป็น `false`)

ยังไม่มีราคาเป็นตัวเลขที่ไหนในผลิตภัณฑ์ ADR 0009 ไม่แตะข้อกำหนดนั้น

## Risk

สิทธิ์ทดลองใช้ที่ออกไปก่อนเวอร์ชันนี้เก็บ `ends_at` ที่คำนวณจาก 5 วันไว้ในฐานข้อมูล การเปลี่ยนค่าคงที่ไม่ย้อนไปแก้แถวเดิม ผู้ใช้กลุ่มนั้นจะได้ 7 วันไม่ครบ งานตัดสินใจว่าจะ migrate หรือไม่ถูกบันทึกเป็น **IP-076** ในเวอร์ชันนี้แล้ว ไม่ได้ปล่อยลอย

## Rollback

กลับไป tag `v0.25.0-circular-readers` แล้ว revert commit ของ v0.26.0 ข้อควรระวังเรื่อง `ends_at` ตามหัวข้อ Risk — การ revert โค้ดไม่ย้อนแถวที่ออกด้วยเงื่อนไข 7 วัน

## Next action

1. **IP-076** — ตัดสินใจว่าสิทธิ์ที่ออกด้วยเงื่อนไข 5 วันจะถูก migrate เป็น 7 วันหรือไม่
2. งานที่ค้างอยู่ในขั้น grilling สองชิ้น ยังไม่มีโค้ดใดถูกเขียน — **หน้า `/pricing` พร้อมปุ่มที่ 5 บนเมนู** (ตกลงแล้วว่าไม่มีตัวเลขราคา ส่งต่อไป `/enterprise`; ค้างที่แกนเปรียบเทียบและสิ่งที่แทนแผงราคาด้านขวา) และ **slider แผงหลักฐานบนหน้า landing** (ค้างที่ชุด 4 สไลด์และป้ายกำกับ)
3. `roadmap.v0.25.0.json` ยังมี `status` เป็น `implementation_in_progress` ทั้งที่ v0.25.0 push และ tag ไปแล้ว ค่าที่ควรเป็นคือ `pushed_tagged_and_released` — ไฟล์เวอร์ชันที่ commit แล้วห้ามแก้ตาม `docs/roadmap/README.md` จึงต้องหาทางบันทึกที่อื่น
