# Handoff — `v0.27.0: An Access Page That Compares Rights, Not Prices`

ข้าม `/grill-with-docs` ตาม AGENTS.md ข้อ 1 เพราะคำถามที่กำกวมจริงถูกถามและตอบก่อนแตะโค้ด ผ่านรอบ grilling ที่บันทึกไว้ในบทสนทนา: แกนเปรียบเทียบของหน้านี้ (ตอบว่า 3 คอลัมน์ตามสิทธิ์จริง พร้อมตารางความสามารถที่ derive จากฟังก์ชันบังคับใช้) และสิ่งที่แทนแผงยอดเงินด้านขวา (ตอบว่าอ่าน entitlement จริง ตัดสวิตช์รายเดือน/รายปีและแถบโควตาออก)

## Description

เพิ่มหน้า `/pricing` เข้ามาเป็นปุ่มที่ 5 บนเมนูหลัก แต่หน้านี้เทียบ **สิทธิ์การเข้าใช้งาน** ไม่ใช่ราคา เพราะ `docs/requirements/civil-apps-market.md` ระบุว่าแพลตฟอร์มไม่ประกาศราคาเป็นตัวเลข งานขององค์กรตอบด้วยการส่งต่อไป `/enterprise` ตาม ADR 0005 พร้อมกันนั้น ADR 0010 ทำให้ข้อความก่อนเข้าใช้งานเป็นประโยคเดียวทุกพื้นผิว

จุดที่ต่างจากเลย์เอาต์อ้างอิงมากที่สุดคือ **ตารางความสามารถไม่ได้ถูกเขียน แต่ถูก derive** ทุกช่องเรียก `listCapabilities()` ซึ่งเป็นฟังก์ชันเดียวกับที่เซิร์ฟเวอร์ใช้ตัดสินว่าอนุญาตหรือไม่ ผลคือหน้านี้อ้างความสามารถที่เซิร์ฟเวอร์ปฏิเสธไม่ได้ และถ้า `STATE_POLICY` เปลี่ยน ตารางเปลี่ยนตามเองโดยไม่มีใครต้องจำ

## Changed Scope

| Area | Files | Summary |
|---|---|---|
| ADR | `docs/adr/0010-…md` | supersede แถว `marketDetail.availabilityNote` ของ ADR 0009; อัปเดตบรรทัด Status ของ 0009 ให้ชี้มาที่ 0010 |
| ข้อความก่อนเข้าใช้งาน | `src/lib/platform.ts` | `availabilityNote` เป็น `"ทดลองใช้งานฟรี 7 วัน"` ประโยคเดียว |
| เนื้อหาหน้าใหม่ | `src/lib/pricing.ts` | `pricingTiers` 3 ระดับ + `capabilityLabel` + `pricingCapabilityRows()` ที่ derive จาก `listCapabilities` + `restrictedAccessNote` |
| หน้าใหม่ | `src/app/pricing/page.tsx`, `src/components/pricing/access-state-panel.tsx` | การ์ด 3 ใบ, ตารางที่ derive, แผงขวาที่อ่าน entitlement จริงและ fail closed, หมายเหตุ ทล. ท้ายหน้า |
| เมนู | `src/lib/landing-interactions.ts`, `src/components/platform/platform-nav.tsx` | ปุ่ม `ราคา` เป็นรายการที่ 3 ของเมนู (ปุ่มที่ 5 รวมทั้งหมด) + `pricingHref` + active state ตาม pathname |
| Styles | `src/app/globals.css` | บล็อก access/pricing, `.visually-hidden`, `.button--ghost`, `.section-heading h1` |
| Tests | `src/lib/pricing.test.ts`, `src/lib/platform.test.ts`, `src/lib/landing-interactions.test.ts` | 6 เทสต์ใหม่บน `pricing.ts` และปรับ contract ของเมนู |

## Verification

| คำสั่ง | ผล |
|---|---|
| `pnpm test` | 175 passed, 33 skipped |
| `pnpm typecheck` | ผ่าน |
| `pnpm lint` | 0 error, 1 warning ที่มีอยู่ก่อนแล้ว |
| `node scripts/check-roadmap.mjs` | `Roadmap 0.27.0 is valid (17 item(s))` |

เทสต์ที่คุ้มค่าที่สุดสองตัว: `pricing.test.ts` ยืนยันว่าไม่มีตัวเลขใดในข้อความระดับสิทธิ์นอกจากความยาววันทดลองใช้ (จับ `บาท|THB|EUR|$` และตรวจว่าเลขทุกตัวเท่ากับ `ESTIMETR_TRIAL_DAYS`) และยืนยันว่าแถว `export`/`print` เป็น `false` เฉพาะคอลัมน์ทดลองใช้ ซึ่งอ่านจากนโยบายจริง ไม่ได้ hardcode

ตรวจใน `localhost:3000/pricing` ด้วยเบราว์เซอร์: เมนูมี 5 ปุ่มรวม `ราคา` และตารางที่เรนเดอร์แสดง `ส่งออกไฟล์` กับ `พิมพ์เอกสาร` เป็น `—` เฉพาะคอลัมน์ `ทดลองใช้งาน` ที่เหลือเป็น `✓` ทั้งแถว

## Security and data impact

ไม่มี migration ไม่แตะสิทธิ์หรือความลับ `AccessStatePanel` เป็น server component ที่เรียก `resolveEstimeterContext()` ซึ่ง fail closed อยู่แล้ว — ไม่มี session หรืออ่าน entitlement ไม่ได้ ก็ลงที่คำเชิญชวนเดียวกัน ไม่เดาว่าใครมีสิทธิ์อะไร และไม่พิมพ์เพดานโครงการแม้ผู้ใช้ล็อกอินแล้ว ตาม ADR 0010

## Risk

`pricingTiers` เป็นเนื้อหาที่ฝังใน source ซึ่งหมายความว่าการแก้ข้อความต้องผ่าน commit งานย้ายเนื้อหาชั้นนี้ออกไปให้ back-office เป็นเจ้าของถูกบันทึกเป็น **IP-079**

ตารางความสามารถแสดง `create_project` เป็น `✓` ทุกคอลัมน์ ซึ่งจริงตามฟังก์ชัน แต่ไม่ได้บอกว่าทดลองใช้สร้างได้กี่โครงการ นี่คือผลที่ตั้งใจของ ADR 0010 ไม่ใช่ข้อบกพร่อง

## Rollback

กลับไป tag `v0.26.0-trial-seven-days` แล้ว revert `f5b0bb6` กับ `1dfc1b6` หน้า `/pricing` เป็นหน้าใหม่ ไม่มีข้อมูลผู้ใช้หรือ schema เกี่ยวข้อง

## Next action

1. **IP-078 มาก่อน IP-079** — ยังไม่มีแนวคิด platform administrator ในระบบ `memberRole` ที่มีอยู่ (`owner/admin/member/viewer`) ผูกกับ `organization_members` คือ admin ของ *องค์กร* ไม่ใช่ของแพลตฟอร์ม การเปิดพื้นผิว back-office ที่เขียนเนื้อหาได้ต้องตัดสินโมเดลสิทธิ์นี้ก่อน และเป็นการตัดสินใจระดับ ADR เพราะย้อนยากและเกี่ยวกับความปลอดภัย ตารางที่รองรับอยู่แล้วคือ `auditEvents` (มี `actorId`, `beforeHash`, `afterHash`) และ `approvalRequests`
2. เจ้าของงานส่งแบบอ้างอิงของ admin panel มาสามชุด (TailPanel, ArchitectUI, และแดชบอร์ด people-analytics แบบสว่าง) และขอให้ทำเป็นทางเลือกให้เลือก งานนี้ยังไม่เริ่ม
3. **slider แผงหลักฐานบนหน้า landing** ยังค้างที่ Q5/Q6 ของรอบ grilling ไม่มีโค้ด
