# Handoff — 2026-08-23 — ESTIMETR Take-off Quantities Become Re-checkable (v0.17.0)

## Description

ปริมาณเลิกเป็นตัวเลขที่พิมพ์เข้าไป และกลายเป็นผลรวมของบรรทัดวัดที่บอกได้ว่าคิดมาอย่างไร แต่ละบรรทัดเก็บ จำนวน × ระยะ ตามที่อ่านจากแบบ จำนวนระยะที่ต้องกรอกถูกบังคับโดยหน่วยของรายการ งานน้ำหนักวัดความยาวแล้วคูณด้วยน้ำหนักต่อเมตรที่ต้องบอกที่มาได้ ค่าเผื่อแยกออกมาเป็นเปอร์เซ็นต์ที่ต้องอ้างอิงหลักเกณฑ์ ไม่ถูกกลืนอยู่ในตัวเลขปริมาณ

พร้อมกันนั้นวางรอยต่อของชั้นราคาไว้ที่ `projects.project_path` ตาม ADR 0007 ก่อนเริ่มงานราคาในเวอร์ชันถัดไป

## Changed Scope

| Area | Files | Summary |
|---|---|---|
| Policy | `docs/adr/0007-two-costing-stacks-over-one-takeoff.md` | ถอดปริมาณชุดเดียวรองรับสองชั้นราคา สายราชการทำก่อน ชั้นถอดปริมาณห้ามมีคอลัมน์ที่พูดถึงเงิน |
| Schema | `src/db/schema.ts`, `drizzle/0002_silly_joseph.sql` | ตาราง `takeoff_measurements`; `takeoff_items.quantity_gross` / `waste_percent` / `waste_source_note`; `projects.project_path` |
| Arithmetic | `src/lib/takeoff-quantity.ts` | `multiplyQuantities` คูณเป็น bigint แล้วปัดครั้งเดียวท้ายสุด, `increaseByPercent` สำหรับค่าเผื่อ |
| Domain | `src/lib/takeoff-measurement.ts`, `src/lib/takeoff-item.ts` | บังคับจำนวนมิติตาม dimension ของหน่วย, mass ต้องมีตัวคูณ + ที่มา, ค่าเผื่อไม่เป็นศูนย์ต้องมีที่มา, ยืนยันรายการต้องมีทั้งบรรทัดวัดและหลักฐาน |
| Project | `src/lib/estimeter-project.ts`, `src/server/estimeter/project-repository.ts`, `src/server/actions/estimeter-project.ts` | เลือกสายงานราชการ/เอกชนตอนสร้างโครงการ และบันทึกลง audit |
| Write path | `src/server/estimeter/takeoff-repository.ts`, `src/server/actions/estimeter-takeoff.ts` | `addItemMeasurement` / `removeItemMeasurement` / `setItemWaste` รวมปริมาณใหม่ในทรานแซกชันเดียวหลังล็อกแถวรายการ; ตรวจรูปแบบซ้ำกับหน่วยที่อยู่ใน DB |
| UI | `add-measurement-form.tsx`, `waste-form.tsx`, `add-item-form.tsx`, `project-form.tsx`, `takeoff/page.tsx`, `globals.css` | ฟอร์มแสดงช่องระยะเท่าที่หน่วยต้องการ, ตารางกางให้เห็น `จำนวน × ระยะ = ปริมาณ`, ฟอร์มเพิ่มรายการเลิกมีช่องปริมาณ |
| Tests | `takeoff-measurement.test.ts`, `takeoff-quantity.test.ts`, `takeoff-item.test.ts`, `estimeter-project.test.ts`, `takeoff-repository.integration.test.ts`, `project-repository.integration.test.ts` | เทียบกับตัวอย่างฐานความรู้, เคสปฏิเสธ, และเคส DB ทั้งหมด |
| Governance | `.gitignore`, `docs/roadmap/roadmap.v0.17.0.json`, `roadmap.json`, `docs/handoff/index.json` | `km/` ถูก ignore; roadmap v0.17.0 |

## Verification

- `pnpm typecheck`, `pnpm lint` (0 warnings), `pnpm build`, `pnpm security:check` ผ่าน
- `ESTIMETR_DB_TESTS=1 pnpm test`: **20 files / 138 tests ผ่านหมด**
- `pnpm db:migrate` apply migration 0002 บนฐานข้อมูล local แล้ว
- เทสต์ที่ตรวจกับ**เอกสาร ไม่ใช่กับตัวเลขที่เราคิดเอง** — ฐานราก F1 ขนาด 1.50 × 1.50 × 0.35 ม., DB12@0.15 สองทาง, cover 0.075, งอ 0.15/ปลาย, เผื่อ 7%
  - คอนกรีต `0.7875` ลบ.ม. (เอกสารพิมพ์ 0.788)
  - ไม้แบบ `2.1` ตร.ม. (เอกสารพิมพ์ 2.10)
  - เหล็ก `29.304` ม. → `31.35528` กก. (เอกสารพิมพ์ 31.36)
- เคส DB ที่เพิ่ม: รวมปริมาณใหม่ในทรานแซกชันเดียว, ลบบรรทัดแล้วยอดกลับ, ค่าเผื่อเก็บทั้งยอดวัดได้และยอดสุทธิ, ยืนยันไม่ได้ถ้าไม่มีบรรทัดวัด, ปฏิเสธจำนวนมิติที่ไม่ตรงหน่วยที่อยู่ใน DB, ยืนยันแล้วล็อกบรรทัดวัด, องค์กรอื่นเขียนไม่ได้ทุกทาง

## Security and data impact

- `km/` (ตำราลิขสิทธิ์และหนังสือเวียนราชการ 261 MB) ถูกเพิ่มใน `.gitignore` แล้ว ก่อนหน้านี้อยู่ห่างจาก GitHub แค่ `git add .` ครั้งเดียว
- ทุก query ใหม่ join กลับ `projects` แล้วกรอง `organizationId` — `takeoff_measurements` ไม่มีคอลัมน์องค์กรเช่นเดียวกับตารางพี่น้อง
- จำนวนมิติถูกตรวจซ้ำฝั่ง server กับหน่วยที่อ่านจาก DB ไม่ใช่หน่วยที่ browser ส่งมา การ POST ตรงจึงข้ามกฎไม่ได้
- audit เพิ่ม `takeoff.measurement_added`, `takeoff.measurement_removed`, `takeoff.waste_set` ทุกอันบันทึกยอดก่อนและหลังเผื่อ
- migration additive ล้วน ไม่เขียนทับ `takeoff_items.quantity` เดิม

## Rollback

กลับไป tag `v0.16.0-estimeter-trial-activation` หรือ revert commit ของ v0.17.0 แล้ว drop migration 0002 ซึ่งเป็น additive ล้วน:

```sql
DROP TABLE takeoff_measurements;
ALTER TABLE takeoff_items DROP COLUMN quantity_gross, DROP COLUMN waste_percent, DROP COLUMN waste_source_note;
ALTER TABLE projects DROP COLUMN project_path;
DROP TYPE project_path;
```

รายการที่สร้างก่อนสไลซ์นี้ยังมีปริมาณเดิมและ `quantity_gross` เป็น NULL ซึ่งหน้าจอแสดงว่า "กรอกมือ ไม่มีรายการคำนวณ" รายการเหล่านั้นยืนยันใหม่ไม่ได้จนกว่าจะบันทึกบรรทัดวัด

## Risk

- **ตัวคูณน้ำหนักต่อเมตรยังกรอกเอง** ระบบบังคับแค่ว่าต้องบอกที่มา ยังไม่มีตารางเหล็กในระบบให้เลือก ถ้ากรอก 0.888 ผิดเป็น 0.088 ระบบจับไม่ได้ ตารางน้ำหนักเหล็กควรเข้ามาพร้อมชุดข้อมูลอ้างอิงใน v0.18.0
- **ค่าเผื่อยังกรอกเปอร์เซ็นต์เอง** หลักเกณฑ์การเผื่อวัสดุมวลรวมเป็นเอกสารราชการที่ควรกลายเป็นตารางให้เลือก ไม่ใช่ข้อความอิสระ
- **หน่วยน้ำหนักคิดจากความยาวเท่านั้น** กรณีที่น้ำหนักมาจากปริมาตร × ความหนาแน่นยังทำไม่ได้ ถ้าเจอของจริงต้องขยายโมเดล
- **workflow ยังค้างที่ 3 / 4** สไลซ์นี้ไม่มีราคา ผู้ทดลองใช้ยังไม่เห็นตัวเลขเงิน

## Next action

1. Push branch `feature/estimeter-measurement-breakdown` และ tag `v0.17.0-estimeter-measurement-breakdown` (รออนุมัติ)
2. สไลซ์ถัดไป **v0.18.0 — Cost catalog + price sources**: ingest ว809 / สพฐ. / สนค. พร้อม provenance และ **ต้องมีขั้นตอนคนตรวจก่อนใช้คำนวณ** เพราะ OCR ของทั้งตาราง Factor F และ ว809 มีข้อผิดพลาดจริงที่ตรวจพบแล้ว (IP-050, IP-051, IP-052)
3. ช่องว่าง schema ที่ต้องปิดใน v0.18.0: `price_observations` ยังไม่มีคอลัมน์ `unit` ไม่แยกค่าวัสดุ/ค่าแรง ไม่มีช่องเงื่อนไข (ว809 ให้อัตราต่างกันตามช่วงจำนวนและเขตพื้นที่) และไม่มีการอ้างหน้าเอกสาร
4. v0.19.0 คือ ปร.4 → ปร.5 (Factor F) → ปร.6 ปิด IP-042 ตอนนั้น
