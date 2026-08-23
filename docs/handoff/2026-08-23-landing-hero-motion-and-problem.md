# Handoff — `v0.21.0: The Landing Says What the Tool Is For, and Shows It Working`

## Description

หน้าแรกเดิมประกาศว่า "แอปงานโยธา ใช้งานง่าย" แล้วให้เลือกแอปทันที โดยไม่เคยบอกว่าปัญหาที่เครื่องมือนี้แก้คืออะไร
และภาพแผนผังฝั่งขวาเป็นภาพนิ่งที่ไม่ได้สื่อว่าเครื่องมือนี้ทำงานเป็นลำดับ ซึ่งเป็นแก่นของ `PROJECT.md`
รอบนี้เพิ่มสองอย่าง: ลำดับ 01-04 ที่เดินให้เห็นพร้อมเส้นสำรวจที่อ่านแผนผังไปเรื่อย ๆ
และหัวข้อปัญหาสามข้อที่มาจากงานประมาณราคาจริง ไม่ใช่ข้อความการตลาด

## Changed Scope

| Area | Files | Summary |
|---|---|---|
| Hero motion | `src/components/landing/hero-engineering-art.tsx`, `src/app/globals.css` | แผนผังวาดตัวเองตามลำดับ สะพาน → อาคาร → กากบาทเล็ง แล้วเส้นสำรวจกับจุดวัดวิ่งอ่านแผนผังต่อเนื่อง กากบาทหมุนช้า |
| Start rail | `src/app/page.tsx`, `src/app/globals.css` | ขั้น 01-04 ไล่ active เป็นวง มีแถบส้มด้านซ้ายและตัวเลขโตขึ้นตอน active หยุดทันทีเมื่อ pointer หรือ keyboard focus อยู่บนขั้นนั้น |
| Problem section | `src/app/page.tsx`, `src/app/globals.css` | `#why` สามการ์ด แต่ละใบมีปัญหาและสิ่งที่ผลิตภัณฑ์ทำกับปัญหานั้น คั่นด้วยเส้น |
| Layout fixes | `src/app/globals.css` | responsive override ใช้ `minmax(0, 1fr)` แทน `1fr` เปล่า และหัวข้อ section ได้ `overflow-wrap` เพราะหัวข้อไทยยาวตัดบรรทัดไม่ได้ |

## Verification

- ถ่ายภาพหน้าจอที่สองจุดของ animation เดียวกัน: จุดหนึ่ง rail อยู่ขั้น 01 อีกจุด rail อยู่ขั้น 04 และจุดวัดสีส้มอยู่คนละตำแหน่งบนสันสะพาน
- รันด้วย `--force-prefers-reduced-motion`: แผนผังครบทุกเส้น ไม่มี highlight ไม่มีเส้นสำรวจ ไม่มีเส้นที่วาดค้าง
- วัดผ่าน DevTools protocol ที่ 1440 และที่ 390 พร้อม mobile emulation: `documentElement.scrollWidth === innerWidth` ทั้งสองขนาด ไม่มี horizontal scroll
- การวัดชุดเดียวกันยืนยันว่า `.workflow-step` ทั้งสี่ขั้นและ `.hero-engineering-art__sweep` มี `animationName` ที่กำลังรัน ไม่ใช่แค่ถูกใส่ style ไว้
- element ที่ยื่นเกิน viewport มีเฉพาะ `nav-pill` ซึ่งอยู่ใน `overflow-x: auto` และ hero art ซึ่งถูก `overflow: clip` — ตั้งใจทั้งคู่
- `pnpm typecheck` ผ่าน, `pnpm lint` 0 errors, `pnpm test` **147 passed | 33 skipped**

## Security and data impact

ไม่มี ไม่มีการเปลี่ยน permission, secret, PII, storage, payment, agent policy หรือ migration
ทั้งหมดเป็นไฟล์นำเสนอสามไฟล์

## Rollback

Revert commit นี้ กลับไปเป็นภาพนิ่งและหน้าแรกที่ไม่มีหัวข้อปัญหา

## Notes worth carrying forward

1. **การ์ดใบที่สามพูดความจริงเรื่องราคา** — เขียนว่า "ชั้นราคายังอยู่ระหว่างพัฒนา ยังไม่เปิดใช้งาน"
   เพราะ `estimation-workspace.tsx:61,96-102` ยังเป็น `useState` ที่จำลองการอนุมัติ price set
   ถ้าวันหนึ่งชั้นราคาเป็นของจริง ต้องกลับมาแก้ประโยคนี้พร้อมกัน ไม่ใช่ปล่อยให้มันเก่าอยู่บนหน้าแรก
2. **เนื้อหาปัญหาสามข้อมาจากงานจริง** — `docs/research/kusumal-hospital-real-project-gap-2026-08-23.md`
   และ `harness-audit-2026-08-23.md` ไม่ใช่ข้อความที่แต่งขึ้นเพื่อขาย
3. **ID ของ roadmap item ชนกันแล้วหนึ่งครั้ง** — `IP-059` ถูกออกสองครั้ง ครั้งแรกใน v0.18.0
   (ต่อยอด check-roadmap) และอีกครั้งใน v0.20.0 (หน่วยของ ปร.4) เป็นคนละงานกัน
   ยกเป็น IP-067 แล้ว เพราะไม่มีอะไรจอง id และ checker ไม่ได้ตรวจ
4. **dev server ที่ port 3000 ตายค้างอยู่** ตอนเริ่มงานนี้ (`uncaughtException: EPIPE` ตั้งแต่ 02:44
   ยัง LISTEN แต่ตอบ HTTP ไม่ได้) รีสตาร์ทแล้ว ถ้าเจออาการ curl ค้างอีก ให้ดู `.next/dev/logs/next-development.log` ก่อน

## Next action

IP-050 — seed ตาราง Factor F เป็น dataset โดยใช้ ว481 (กค 0433.2/ว 481 ลงวันที่ 26 มิถุนายน 2569,
ดอกเบี้ย 6%) ที่เจ้าของงานส่งมาแล้ว ปิด IP-063 ไปพร้อมกัน

**คำถามที่ยังไม่มีคำตอบและกระทบตัวเลขโดยตรง:** ปร.4 ของกุสุมาลย์ใช้ Factor F ของแถวค่างาน 2 ล้านตรง ๆ
(1.3034) ทั้งที่ค่างานต้นทุนคือ 2,529,230.20 และหมายเหตุท้ายตารางสั่งให้เทียบอัตราส่วน
ถ้าเทียบอัตราส่วนจะได้ 1.302835 และยอดสุทธิต่างกัน 1,400 บาท ต้องให้ผู้มีอำนาจตัดสินว่าปฏิบัติจริงยึดข้อไหน
ก่อนเขียนตัวเลือกใดตัวเลือกหนึ่งลงในโค้ด
