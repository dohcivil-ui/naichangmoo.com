# Real-project gap check — อาคารฟอกไต ปุญโญภาส, โรงพยาบาลกุสุมาลย์

**Date:** 2026-08-23
**Sources (not in the repository, held under `km/kusumal_hospital/`):**
- `ราคากลาง อาคารฟอกไต ปุญโญภาส.pdf` — a complete ปร.4(ก) / ปร.5(ก) / ปร.6 set, priced 20 มิถุนายน 2569
- `แบบก่อสร้างอาคารฟอกไต ปุญโญภาส (ฉบับสมบูรณ์).pdf` — the construction drawings and specification notes

Checked against ESTIMETR at v0.17.0.

## What the real document proves our arithmetic gets right

Every figure reconciles exactly against the model we built:

```
รวมค่าวัสดุ    2,063,850.95
รวมค่าแรงงาน     465,379.25
ค่างานต้นทุน   2,529,230.20   = the two summed, to the satang
× Factor F         1.3034
ค่าก่อสร้าง    3,296,598.64
ยอดสุทธิ       3,296,500.00   = floored to the nearest 100
```

This confirms the shape assumed in ADR 0007: a government estimate is a single multiplication of a summed cost of work, and the material and labour columns are totalled separately before they are added.

## Findings, most severe first

### 1. Our Factor F reference is the wrong table

The project states its conditions on ปร.5(ก): เงินล่วงหน้าจ่าย 0%, เงินประกันผลงานหัก 0%, **ดอกเบี้ยเงินกู้ 6%**, ภาษีมูลค่าเพิ่ม 7%.

`km/ตาราง Factor F อาคาร ใหม่.pdf` — the table the v0.17.0 plan named as the source for IP-050 — contains **only 7%** across all twelve of its variants. The value this project actually used, **1.3034**, does not exist anywhere in it.

The risk recorded in the plan ("Factor F ผูกกับดอกเบี้ยเงินกู้ ถ้าอัตราเปลี่ยน ตารางเปลี่ยนทั้งชุด") is therefore not hypothetical: our only Factor F source is already stale against a June 2569 project. Seeding it as-is would produce numbers that look official and are wrong.

**Action:** IP-050 must obtain the 6% table (announced under a ว-series circular succeeding ว499) before any Factor F is used in a calculation, and the dataset must be keyed by interest rate, not merely carry it as a note.

### 2. 35% of the real BOQ cannot be entered into ESTIMETR at all

Unit usage across the 91 measured lines of this ปร.4:

| หน่วย | lines | in `TAKEOFF_UNITS`? |
|---|---:|---|
| ชุด | 20 | yes (`set`) |
| ตร.ม. | 19 | yes (`sq_m`) |
| **ท่อน** | **18** | **no** |
| ตัว | 10 | only as `each`, whose label prints "หน่วย" |
| **ม้วน** | **6** | **no** |
| ม. | 5 | yes (`m`) |
| **งาน** | **5** | **no** |
| ลบ.ม. | 4 | yes (`cu_m`) |
| **ถัง** | **3** | **no** |
| แผ่น | 1 | yes (`sheet`) |

**32 lines (35%) have no unit to select.** ท่อน alone is the second most common unit in the document.

### 3. กก. and ตัน appear zero times — and rebar is counted in ท่อน

The mass path built in v0.17.0 (measure a length, convert through a cited weight per metre) is careful and correct as engineering, but **this document never uses it**. Reinforcement is priced by the bar:

```
เหล็ก DB 20 mm.    46.00 ท่อน
เหล็ก DB 16 mm.   344.00 ท่อน
เหล็ก DB 12 mm.   212.00 ท่อน
เหล็ก RB 9 mm.    403.00 ท่อน
```

Weight-per-metre still matters — it is how a person gets from bar-metres on the drawing to the number of 10 m bars to buy — but it belongs to the take-off working, not to the ปร.4 line. Our model currently forces the opposite.

**Action:** add `ท่อน` as a counted unit, and treat the kg/m table as a helper that converts a measured length into bars, rather than as the unit of the priced line.

### 4. `งาน` is a lump sum with nothing to measure

Five lines are priced as `1.00 งาน` — ระบบกำจัดปลวก, งานตัวอักษรป้าย, อุปกรณ์ไฟฟ้า, อุปกรณ์งานสุขาภิบาล, ตกแต่งผิวฉาบ. A lump sum has no width, length or thickness by definition.

Our `DIMENSION_RANK` requires the unit's dimension to decide how many lengths a line carries; a lump sum needs an explicit rank of zero **and** a rule that its count is always 1. Adding it as an ordinary `count` unit would let someone enter "3 งาน", which is not a measurement.

### 5. `takeoff_items` is flat; ปร.4 is a numbered hierarchy

The real form is organised as:

```
1    งานส่วนที่ 1
1.1    งานดินขุด-ดินถม
1.2    งานโครงสร้าง คอนกรีตเสริมเหล็ก
1.3    งานโครงหลังคา
1.4    งานสถาปัตยกรรม
1.5    งานประตู-หน้าต่าง
1.6    งานไฟฟ้า
1.7    งานสุขภัณฑ์-สุขาภิบาล
1.8    งานอื่นๆ
```

with a group subtotal printed on the header row. We have a flat list ordered by `created_at` and a closed set of five categories. The document uses eight groups, and `งานอื่นๆ` has no equivalent in ours at all. `ลำดับที่` is printed on the form and we do not store it.

### 6. `projects` is missing every header field the form requires

ปร.6 and ปร.5(ก) both print: งานก่อสร้าง · **สถานที่ก่อสร้าง** · **หน่วยงาน** · แบบ ปร.4 ที่แนบ จำนวน N แผ่น · **ประมาณราคาเมื่อวันที่**; ปร.4(ก) adds **ประมาณราคาโดย**.

`projects` holds `name`, `workType`, `path`, `state` and nothing else. Four fields the official output cannot be produced without are absent.

### 7. The amount must be written out in Thai words

Both ปร.5(ก) and ปร.6 print `(สามล้านสองแสนเก้าหมื่นหกพันห้าร้อยบาทถ้วน)` beneath the figure. `src/lib/thai-format.ts` formats dates only. A baht-to-Thai-text function is required, and it must agree with the floored figure rather than the unrounded one.

### 8. The rounding rule is floor-to-hundred, and it is not modelled

`3,296,598.64 → 3,296,500.00`. Not round-half-up, not floor-to-baht: floored to the nearest hundred, and the discarded 98.64 is simply dropped. The `**` marker beside the total on both sheets appears to flag exactly this adjustment.

### 9. Lines can be material-only or labour-only

`งานดินขุด` carries a labour rate and `-` for material; `โคมไฟฝังฝ้า` carries material and `-` for labour. A zero and a `-` are different statements: one claims the cost is nothing, the other that the column does not apply. IP-051 already calls for a material/labour split; it should also carry the distinction between "not applicable" and "zero".

### 10. A cross-check the tool could make and currently cannot

The drawing's general notes specify `กำลังคอนกรีตไม่น้อยกว่า 240 กก./ซม²`, while the ปร.4 prices `คอนกรีตโครงสร้าง 280 ksc. ทรงลูกบาศก์ (หินภูเขา)`. That is not a contradiction — 280 satisfies 240 — but it is precisely the sort of drawing-to-BOQ agreement a reviewer checks by hand today. It is also the first concrete argument for the drawing upload slice: without the drawing in the system, the tool cannot see the specification it is being priced against.

Other values the drawings state that a take-off needs and we do not hold: cover 1.5 cm to slabs and 2.5 cm to beams and columns; lap length 80× diameter for SR24 and 36× for SD30; concrete mix 1:2:4 structural and 1:3:5 lean.

## Effect on the planned slices

- **v0.18.0 (cost catalog)** — unchanged in intent, but IP-050 is now blocked on obtaining the 6% Factor F table, and IP-051 grows the "not applicable" case.
- **New work, ahead of v0.19.0** — units, lump sum, hierarchy with `ลำดับที่`, project header fields, Thai baht text and the floor-to-hundred rule. Without these the ปร.4/5/6 output cannot be produced at all, whatever the pricing layer does.
- **v0.17.0 is not wrong, but it is narrow.** The arithmetic reconciles to the satang against a real document. The unit vocabulary it enforces covers barely half of one.
