# Handoff — 2026-08-23 — ESTIMETR Can Hold a Real ปร.4 (v0.20.0)

## Description

ตรวจงานจริงที่ประมาณราคาเสร็จแล้ว — อาคารฟอกไต ปุญโญภาส โรงพยาบาลกุสุมาลย์ ประมาณราคา 20 มิถุนายน 2569 มีทั้งแบบก่อสร้างและชุด ปร.4(ก)/ปร.5(ก)/ปร.6 ครบ — แล้วปิดช่องว่างที่ทำให้เอกสารชิ้นนั้นกรอกเข้าระบบเราไม่ได้

เลขคำนวณของเราตรงกับเอกสารจริงทุกบาท แต่ **35% ของบรรทัดในเอกสารไม่มีหน่วยให้เลือก** สไลซ์นี้แก้เรื่องนั้นและอีกห้าข้อที่ตามมา

## Changed Scope

| Area | Files | Summary |
|---|---|---|
| Research | `docs/research/kusumal-hospital-real-project-gap-2026-08-23.md` | บันทึกการตรวจกับงานจริง 10 ข้อ เรียงตามความรุนแรง |
| Units | `src/lib/takeoff-units.ts` | เพิ่ม ท่อน ม้วน ถัง งาน; `each` พิมพ์ว่า "ตัว"; หมวดงานขยายเป็น 8 หมวดตามใบจริง รวม งานอื่นๆ |
| Lump sum | `src/lib/takeoff-measurement.ts` | dimension `lump` ไม่มีระยะให้วัดและจำนวนเป็น 1 เสมอ บังคับทั้ง parser และ write path |
| Outline | `src/lib/takeoff-outline.ts` + test | ลำดับที่คำนวณจากตำแหน่ง ไม่เก็บ; กันหมวดกำพร้าและหมวดที่วนกลับหาตัวเอง |
| Money | `src/lib/thai-baht.ts` + test | อ่านจำนวนเงินเป็นภาษาไทย และปัดลงหลักร้อย เก็บเป็น satang ใน bigint |
| Schema | `src/db/schema.ts`, `drizzle/0004_sour_makkari.sql` | ตาราง `takeoff_groups` (มี parent), `takeoff_items.group_id`, `projects.site_location` / `agency_name` |
| Write path | `src/server/estimeter/takeoff-repository.ts`, `project-repository.ts`, actions | `addRunGroup` / `removeRunGroup` / `assignItemGroup`; หัวฟอร์มไหลผ่านตอนสร้างโครงการ |
| UI | `group-forms.tsx`, `takeoff/page.tsx`, `project-form.tsx` | ตารางแสดงเป็นลำดับชั้นแบบใบจริง มีแถวหัวหมวดพร้อมลำดับที่ และช่องย้ายหมวดต่อรายการ |
| Governance | `docs/roadmap/roadmap.v0.20.0.json`, `roadmap.json`, `package.json`, `docs/handoff/index.json` | v0.20.0 |

**ไม่ได้แตะ `src/app/globals.css`** — อีก session กำลังทำ design overhaul อยู่บนไฟล์นั้น UI ใหม่ใช้ class ที่มีอยู่แล้วทั้งหมด

## Verification

- `ESTIMETR_DB_TESTS=1 pnpm test`: **23 files / 180 tests ผ่านหมด**
- `pnpm typecheck`, `pnpm lint` (0 warnings), `pnpm build`, `pnpm security:check` ผ่าน
- `pnpm db:migrate` apply migration 0004 บนฐานข้อมูล local แล้ว

**ตรวจกับเอกสารจริง ไม่ใช่กับตัวเลขที่เราคิดเอง**

```
ค่าวัสดุ    2,063,850.95
ค่าแรงงาน     465,379.25
ค่างานต้นทุน 2,529,230.20   ← บวกกันตรงถึงสตางค์
ปัดลงหลักร้อยจาก 3,296,598.64 → 3,296,500.00  ← ตรงกับยอดสุทธิที่ใบพิมพ์
อ่านเป็นไทย → สามล้านสองแสนเก้าหมื่นหกพันห้าร้อยบาทถ้วน  ← ตรงกับวงเล็บในใบ
ลำดับที่ 1 → 1.1…1.8 → ตรงกับหัวหมวดในใบ และลบ 1.2 แล้ว 1.3 เลื่อนเป็น 1.2 เอง
```

## Security and data impact

- ทุก query ของหมวดงาน join กลับ `projects` แล้วกรอง `organizationId` เช่นเดียวกับตารางพี่น้อง `takeoff_groups` ไม่มีคอลัมน์องค์กร
- การเพิ่มหมวดใต้หมวดอื่นตรวจว่า parent อยู่ใน run เดียวกัน จึงเอาหมวดข้ามโครงการมาเป็นแม่ไม่ได้
- ลบหมวดแล้วรายการไม่หาย (`ON DELETE SET NULL`) หลักฐานและรายการคำนวณอยู่ครบ
- audit เพิ่ม `takeoff.group_added`, `takeoff.group_removed`, `takeoff.item_grouped`
- migration additive ล้วน ไม่เขียนทับแถวเดิม

## Rollback

กลับไป tag `v0.19.0-design-language-file` หรือ revert commit ของ v0.20.0 แล้ว drop migration 0004:

```sql
ALTER TABLE takeoff_items DROP COLUMN group_id;
DROP TABLE takeoff_groups;
ALTER TABLE projects DROP COLUMN site_location, DROP COLUMN agency_name;
```

## Risk

- **ตาราง Factor F ที่มีอยู่ใช้กับงานปัจจุบันไม่ได้** งานจริงชิ้นนี้ใช้ดอกเบี้ยเงินกู้ 6% ได้ Factor F 1.3034 แต่ไฟล์ที่เรามีเป็น 7% ทั้ง 12 ตาราง ค่านั้นหาไม่เจอในนั้นเลย ต้องได้ตาราง 6% ก่อนคิดราคากลางใด ๆ (IP-063)
- **`category` กับหมวดงานทับซ้อนกัน** ตอนนี้รายการหนึ่งถูกจัดสองที่ ควรเลิกใช้ `category` เมื่อหมวดงานนิ่งแล้ว (IP-065)
- **ประมาณราคาเมื่อวันที่/โดย ยังไม่มีที่อยู่** มันเป็นสมบัติของ revision ไม่ใช่ของโครงการ จึงยังไม่ใส่ (IP-064)
- **สาขาแยกจากอีก session** branch นี้ไม่มี commit ของ v0.19.0 ตอน merge จะชน `roadmap.json` และ `package.json` แน่นอน ต้องแก้ conflict ด้วยมือโดยให้ v0.20.0 ชนะ

## Next action

1. Push branch `feature/estimeter-pr4-representable` และ tag `v0.20.0-estimeter-pr4-representable`
2. **IP-063 ต้องมาก่อนงานราคา** — ขอตาราง Factor F ที่อัตราดอกเบี้ยปัจจุบัน ถ้าไม่มี ราคากลางที่ระบบคำนวณจะป้องกันไม่ได้
3. สไลซ์ถัดไปคือ cost catalog พร้อม provenance (IP-050, IP-051, IP-052) แล้วจึงเป็น ปร.4 → ปร.5 → ปร.6
