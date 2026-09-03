# ขั้นลงมือ IP-234 — รายการวัดจากหน้าวาดลงฐาน และส่งเข้าถอดปริมาณเป็น backup sheet

**ผู้วางแผน** Fable · **ผู้ลงมือ** builder (Opus 5) · **ต้องทำหลัง** IP-233 เสร็จและกดจริงผ่านแล้ว
**แผนแม่** `2026-09-02-quantity-provenance-and-persistence.md` หัวข้อสาม · **ADR** 0024 ข้อ 7

กติกาเดียวกับสเปก IP-233: ทางแยกที่ไม่ได้เขียน → หยุดส่งกลับ · gate เขียวก่อนทุก commit ·
`(IP-234)` ท้ายบรรทัดแรก · ห้าม push · ไทยเขียนด้วย Write/Edit เท่านั้น · ศัพท์สากลทับศัพท์ · ไม่มี emoji

---

## หลักที่สเปกนี้ยืนอยู่ (คำตัดสินของเจ้าของงาน 2026-09-03)

*"คล้าย ๆ การทำ backup sheet — แยกย่อยทีละจุด ชี้ที่มาที่ไปได้ สุดท้ายค่อยไปสรุปแล้วส่งยอดรวมขึ้น ปร.4"*

จึงมี**สองชั้นที่แยกกันชัด** และการไหลจากชั้นหนึ่งไปอีกชั้นเป็น**การกระทำของคน** ไม่ใช่อัตโนมัติ

| ชั้น | คืออะไร | เก็บที่ | หายไหมเมื่อปิดเว็บ |
|---|---|---|---|
| **mark** (รอยวัดบนแบบ) | เส้น รูป หมุด ที่คนวาดไว้ มีชื่อหรือไม่มีก็ได้ ยังไม่ใช่ปริมาณ | `drawing_marks` (ตารางใหม่ ข้อ 1) | ไม่หาย |
| **measurement** (บรรทัดใน backup sheet) | ปริมาณที่คนส่งเข้าถอดปริมาณแล้ว ใต้ take-off item หนึ่งรายการ พร้อม method และ evidence ชี้กลับหน้าและพิกัด | `takeoff_measurements` + `evidence_references` | ไม่หาย |

ทำไมไม่ให้ทุก mark กลายเป็น measurement ทันที — `takeoff_items` ต้องมี `category` (NOT NULL) กับ
`description` และหน่วยนับ (ชุด/ตัว/ท่อน…) เลือกเองจากรูปไม่ได้ การเดาค่าตั้งต้นให้เงียบ ๆ คือการ
ตัดสินใจแทนผู้ใช้ และรายการที่หมวดผิดจะถูกคูณด้วยตัวคูณผิด (ADR 0008) โดยเลขยังดูถูกทุกตัว

---

## ขั้น 1 — migration 0016: ตาราง `drawing_marks`

**ต้องให้เจ้าของงานเคาะก่อนรัน `db:migrate`** (เขาสั่งให้ถามก่อนแตะ schema) — เขียน schema +
generate + เทสต์ได้ก่อน แต่หยุดก่อน migrate แล้วรายงาน

```
drawing_marks
  id            text PK
  document_id   text NOT NULL → drawing_documents CASCADE
  page_number   integer NOT NULL CHECK > 0
  marks         jsonb NOT NULL        -- {version:1, items: StoredMark[]}
  updated_by    text NOT NULL → users
  created_at / updated_at
  UNIQUE(document_id, page_number)
```

- ทำไมไม่ยัดใน `drawing_calibrations`: แถวนั้นเกิดเมื่อคนยืนยันสเกล และ `confirmed_by` ต้องหมายถึง
  "ใครยืนยันสเกล" ถ้าเอา mark ไปแขวนไว้ที่นั่น การวาดหมุดนับหนึ่งอันจะไป re-stamp ชื่อคนยืนยันสเกล
  และหน้าที่ยังไม่มีสเกล (นับจำนวนไม่ต้องใช้สเกล) จะไม่มีที่เก็บ
- `StoredMark = Measurement & { filed: { itemId; measurementId; evidenceId } | null; layerId: string | null }` —
  `Measurement` จาก `drawing-measurement.ts` (id, page, kind, name, points, colour) บวกร่องรอย
  ว่าถูกส่งเข้าถอดปริมาณแล้วหรือยัง และชั้นที่มันสังกัด
- **`layerId` ใส่ตั้งแต่ใบนี้ ไม่ใช่ migration ใบหลัง** (เจ้าของงานเคาะ 2026-09-03 ·
  สเปก `2026-09-03-drawing-layers.md` หัวข้อสอง) เพราะ layer เป็นความสัมพันธ์ที่แขวนอยู่กับ
  ตัว object ทุกชิ้น ถ้าไม่ใส่ตอนนี้ต้องเขียน migration ถอนอีกใบเพื่อแก้รูป jsonb ทีหลัง ·
  รอบนี้ **ยังไม่มีตารางทะเบียนชั้น** ค่าจึงเป็น `null` ทุกแถว แปลว่า "ยังไม่จัดชั้น"
  และหน้าจอยังไม่มี UI ให้ตั้งค่านี้ · ห้าม parser ปฏิเสธแถวที่ `layerId` เป็น `null`
- **ไม่ลง audit** เหตุผลเดียวกับ `drawing_view_states`: การลากเส้นยังไม่ใช่การกระทำที่ต้องตรวจย้อน
  จุดที่ต้องตรวจย้อนคือตอนส่งเข้าถอดปริมาณ ซึ่งลง audit อยู่แล้วในเส้นทาง take-off
- เพิ่ม `drawingMarks` เข้า `CLOSED_TABLES` · เข้า `schema` object
- parser `parseMarksPayload(unknown)` ใน `drawing-state.ts` (ไฟล์จาก IP-233) กติกาเดียวกับตัวอื่น ·
  `kind` ต้องผ่าน `isMeasurementKind` (มีอยู่ที่ `drawing-measurement.ts:115`) · `points` อย่างน้อย
  `minimumPoints(kind)` · `colour` string ไม่ว่าง · `filed` เป็น null หรือสามช่อง string ไม่ว่าง ·
  `layerId` เป็น null หรือ string ไม่ว่าง (ช่องที่หายไปเลยให้อ่านเป็น null ได้ เพราะแถวที่เขียน
  ก่อนมี layer ไม่มีช่องนี้ แต่ช่องที่มีค่าผิดรูปยังต้องคืน null ทั้งก้อนตามกติกาเดิม)

## ขั้น 2 — `takeoff-measurement.ts`: กติกาหน่วยสำหรับแถวที่มาจากการวาด (ADR 0024 ข้อ 7)

```ts
export function measurementMatchesUnit(
  line: MeasurementFactors & { conversionNote?: string | null },
  unitCode: string,
  method: QuantityMethod = "typed"
): boolean
```
- `method === "pointer" || method === "region_trace"` และ `unit.dimension === "area"` →
  ยอมรับ `dimensions.length === 1` (พื้นที่ค่าเดียว) **นอกนั้นกติกาเดิมทุกบรรทัด**
- ค่าตั้งต้น `"typed"` ทำให้ทุกจุดเรียกเดิมทำงานเหมือนเดิมโดยไม่ต้องแก้
- คอมเมนต์หัวฟังก์ชันอ้าง ADR 0024 ข้อ 7 และประโยค "จุดยอดคือตัวประกอบ อยู่ในหลักฐาน"
- เทสต์ใน `takeoff-measurement.test.ts`: `typed` + sq_m + 1 มิติ → false (เดิม) · `pointer` + sq_m +
  1 มิติ → true · `pointer` + sq_m + 2 มิติ → true (rect) · `pointer` + cu_m + 1 มิติ → false ·
  `typed` + m + 1 มิติ → true (ไม่เปลี่ยน)

## ขั้น 3 — `src/lib/takeoff-from-measurement.ts` + เทสต์ (บริสุทธิ์)

```ts
export type FiledLine = {
  unitDimension: "length" | "area" | "count";   // บอกฟอร์มว่าหน่วยเลือกได้แค่ไหน
  method: QuantityMethod;                        // pointer | pointer_count | region_trace
  measurement: MeasurementInput;                 // label, count, dimensions[], conversion null
  geometry: EvidenceGeometry;                    // ข้อ 4
};
export type FiledLineResult = { ok: true; line: FiledLine } | { ok: false; reason: "needs_scale" | "too_few_points" };

export function toFiledLine(mark: Measurement, scale: PageScale | null, origin: "pointer" | "region_trace"): FiledLineResult
```
- `origin` มาจาก caller: mark ที่เกิดจากเครื่องมือ `room` → `"region_trace"` นอกนั้น `"pointer"` ·
  **ต้องเพิ่มช่อง `origin: "pointer" | "region_trace"` ลง `Measurement`** (drawing-measurement.ts)
  เพราะวันนี้ห้องกับรูปหลายเหลี่ยมที่ลากเองแยกไม่ออกหลังยืนยัน — `pickRoom` (:762) ตั้ง
  `origin:"region_trace"` ส่วน `finish`/สร้างรูปเอง (:813) ตั้ง `"pointer"` · parser ขั้น 1 รับช่องนี้ ·
  ค่าเก่าใน browser state ไม่มี (ยังไม่เคยเซฟ) จึงไม่มี migration ของข้อมูล
- ตารางแปลง (ใช้ `measure()` จาก drawing-measurement เป็นแหล่งตัวเลขเดียว **ห้ามคำนวณซ้ำ**):

| kind | method | count | dimensions | unitDimension |
|---|---|---|---|---|
| length, polyline | pointer | 1 | [lengthMetres] | length |
| rect | pointer | 1 | [กว้าง, ยาว] จาก `rectangleCorners` คูณสเกล | area |
| area (origin pointer) | pointer | 1 | [areaSquareMetres] | area |
| area (origin region_trace) | region_trace | 1 | [areaSquareMetres] | area |
| count | pointer_count | points.length | [] | count |

- ตัวเลขเป็น string ทศนิยม 6 ตำแหน่ง (`toFixed(6)`) เพราะคอลัมน์ `numeric(18,6)` — เทสต์ต้องพิสูจน์ว่า
  `measurementSubtotal(line)` เท่ากับค่าที่ `measure()` ให้ ในระดับ 6 ตำแหน่ง
- `label` = `หน้า ${page} · ${measurementKindLabel[kind]}` (ไทยล้วน) · ผ่านกติกา `LABEL_MIN/MAX` เดิม
- `needsScale(kind)` จริงแต่ `scale` เป็น null → `needs_scale` · จุดน้อยกว่า `minimumPoints` → `too_few_points`
- เทสต์: ทุกแถวของตาราง · needs_scale · rect ให้สองมิติที่คูณกันเท่ากับ area จาก `measure()` ·
  ไม่มี key เงินหรือราคาในผลลัพธ์ (grep ชื่อช่อง)

## ขั้น 4 — `src/lib/drawing-evidence.ts` + เทสต์ (ก้อน 2 ของแผนแม่ ครึ่งที่ต้องใช้)

```ts
export type EvidenceGeometry = {
  kind: "measurement"; version: 1; page: number; measurementKind: MeasurementKind;
  origin: "pointer" | "region_trace"; points: PagePoint[];
  scale: { metresPerPoint: number } | null;   // null เฉพาะ count ซึ่งไม่ใช้สเกล
};
export function parseEvidenceGeometry(value: unknown): EvidenceGeometry | null
```
สเกลถูก**ก๊อป ณ ตอนส่ง** ไม่ใช่อ้างแถว calibration — วันที่คนแก้สเกลทีหลัง หลักฐานของค่าที่ส่งไปแล้ว
ต้องยังบอกได้ว่าตอนนั้นคูณด้วยอะไร (เหตุผลเดียวกับ `conversionNote`) · สมาชิก union ตัวอื่นของแผนแม่
(grid-node, text-span) **ยังไม่เพิ่ม**

## ขั้น 5 — repository

### 5.1 `drawing-repository.ts` เพิ่ม `saveMarks` / `loadDrawingState` คืน marks ด้วย
- `saveMarks({ organizationId, documentId, actorId, pageNumber, marks: StoredMark[] })` upsert ที่
  `(documentId, pageNumber)` · ตรวจทุก mark `page === pageNumber` · marks ว่าง → **ลบแถว** ไม่ใช่เก็บ
  `{items:[]}` · ไม่มี audit
- `loadDrawingState` เพิ่ม `marks: Record<number, StoredMark[]>` (parse ไม่ผ่าน → หน้านั้นเป็น `[]`)

### 5.2 `takeoff-repository.ts`: แยกตัวใน transaction ออกมาเพื่อให้เรียกซ้อนได้
วันนี้ `startManualRun` `addManualItem` `addItemMeasurement` `addItemEvidence` แต่ละตัวเปิด
`getDb().transaction` เอง ซ้อนกันไม่ได้ · **refactor เชิงกล ไม่เปลี่ยนพฤติกรรม**: ย้ายเนื้อในของแต่ละตัว
เป็น `xxxTx(tx: Tx, input)` แล้วให้ตัวเดิมเป็น `return getDb().transaction((tx) => xxxTx(tx, input))` ·
เทสต์เดิมทั้งหมดต้องผ่านโดยไม่แก้เทสต์
- `addItemMeasurementTx` รับเพิ่ม `method: QuantityMethod` และ `methodContext: MethodContext | null`
  (**ไม่มีค่าตั้งต้น** — จุดเรียกจากฟอร์มส่ง `"typed"`, `null` ชัด ๆ) · เรียก
  `measurementMatchesUnit(input.measurement, unit, method)` · เขียน `proposalId: null`
- `addItemEvidenceTx` รับเพิ่ม `documentId: string | null` และ `geometry: EvidenceGeometry | null`
  (ฟอร์มเดิมส่ง null ทั้งคู่) · **เทสต์ไม่ถดถอย**: mock/spy insert ของเส้นทางฟอร์มเดิมต้องได้ค่า
  `documentId: null, geometry: null` — เพราะแผนแม่ก้อน 10 บอกไว้ว่ากับดักใหญ่ที่สุดคือเส้นทางเดิม
  เปลี่ยนไบต์โดยไม่รู้ตัว
- `startManualRunTx` รับเพิ่ม `documentId?: string` — ถ้าสร้าง run ใหม่ให้ตั้ง `takeoffRuns.documentId` ·
  ถ้า run เดิมมีอยู่และ `documentId` เป็น null → UPDATE ให้ · ถ้า run เดิมมี documentId อื่น →
  **ไม่แตะ** (โครงการหนึ่งอาจมีแบบหลายใบ run ผูกกับใบแรกที่ส่ง — จำกัดที่รู้อยู่ บันทึกในคอมเมนต์)
- `MeasurementView` เพิ่ม `method: QuantityMethod` (select เพิ่ม, `listMeasurementsForItems`) ·
  `EvidenceView` เพิ่ม `documentId: string | null` (ยังไม่ต้องคืน geometry ให้หน้า take-off)

### 5.3 `fileMarkIntoTakeoff` (ฟังก์ชันใหม่ใน `takeoff-repository.ts`)
```ts
({ organizationId, projectId, actorId, documentId, calibrationId: string | null,
   item: TakeoffItemInput, line: FiledLine, markId: string })
  → WriteResult<{ runId; itemId; measurementId; evidenceId; reused: boolean }>
```
ธุรกรรมเดียว: `startManualRunTx(documentId)` → หา item ใน run ที่ `description` และ `unit` ตรง
(เทียบหลัง `trim`) และ `reviewState !== "confirmed"` → เจอใช้ (`reused:true`) ไม่เจอ
`addManualItemTx` → `addItemMeasurementTx(method: line.method, methodContext: {version:1, calibrationId})`
→ `addItemEvidenceTx({ note: \`วัดจากแบบ หน้า ${page}\`, pageNumber, documentId, geometry })` ·
audit ของแต่ละขั้นมีอยู่แล้วในตัว Tx ไม่ต้องเพิ่ม · ปฏิเสธ `item_locked` ถ้า item ที่ตรงชื่อถูก confirm แล้ว
(ให้คนตั้งชื่อใหม่ ไม่แอบสร้างซ้ำ)
- integration test: ส่ง mark สองอันชื่อเดียวกัน → item เดียว measurement สองแถว `quantity` =
  ผลรวม · ชื่อต่าง → สอง item · `method` ในแถวเป็น `pointer` / `region_trace` / `pointer_count`
  ตามชนิด · `evidence.geometry` parse กลับได้เท่าที่ส่ง · `takeoffRuns.documentId` ถูกตั้ง ·
  item ที่ confirm แล้วชื่อตรง → `item_locked`

## ขั้น 6 — actions (`estimeter-drawing.ts`)
- `saveDrawingMarks({ documentId, pageNumber, marks })` (parse ก่อน)
- `fileDrawingMark({ documentId, pageNumber, markId, category, description, unit })` — เซิร์ฟเวอร์
  **โหลด mark จาก `drawing_marks` เอง** ไม่รับ points จาก client (client ส่งแค่ id) แล้วเรียก
  `toFiledLine` + `fileMarkIntoTakeoff` · ตรวจ `unit` ให้อยู่ใน dimension ที่ `line.unitDimension`
  อนุญาต · ตรวจ item ด้วย `parseTakeoffItemForm` (ประกอบ `FormData` จากสามช่อง เพื่อใช้กติกาเดิม
  ไม่เขียนซ้ำ) · สำเร็จแล้ว UPDATE mark ใน jsonb ให้ `filed = {itemId, measurementId, evidenceId}`
  ในธุรกรรมเดียวกัน · `revalidateTakeoff(projectId)` (มีอยู่ใน estimeter-takeoff.ts — export ออกมา
  หรือย้ายไป edit-access.ts)
- `loadDrawing` คืน marks ด้วย

## ขั้น 7 — หน้าจอ

### 7.1 `drawing-markup.tsx`
- `Measurement` ที่อยู่ใน state คือ `StoredMark` (มี `origin` และ `filed`) · เมื่อโหลด: marks ทุกหน้า
  เข้า `measurements` (ไม่ผ่าน `commitWork`)
- effect เซฟ marks ต่อหน้า debounce 800ms ลายเซ็นต่อหน้า แบบเดียวกับ grid (IP-233 ขั้น 5.3)
  แต่**ไม่ต้องมีสเกล** · ครอบ undo/redo/rename/remove
- **mark ที่ `filed` แล้วล็อกบนหน้าวาด**: ลบไม่ได้ แก้จุดไม่ได้ เปลี่ยนชื่อไม่ได้ · ป้ายเล็ก "ส่งแล้ว" ใน
  `MeasurementRegister` และปุ่มลบซ่อน · ข้อความเมื่อพยายาม: "รายการนี้ส่งเข้าถอดปริมาณแล้ว ลบได้
  จากหน้าถอดปริมาณ" · undo ที่จะทำให้ mark ที่ filed หายไป → ข้ามรายการนั้น (คง mark ไว้)
- ปุ่ม "ส่งเข้าถอดปริมาณ" ต่อรายการใน `MeasurementRegister` (เฉพาะที่ยังไม่ filed และไม่ blockedByScale)
  → กล่องซ้อนหน้า (`mk__dialog` แบบเดียวกับกล่องตั้งสเกล) สามช่อง:
  - **รายการ** (description) prefill จาก `name` · required
  - **หมวดงาน** select จาก `TAKEOFF_CATEGORIES` · ไม่มีค่าเลือกล่วงหน้า · required
  - **หน่วย** — length: แสดง "ม." ตายตัว · area: "ตร.ม." ตายตัว · count: select จาก `TAKEOFF_UNITS`
    ที่ `dimension === "count"` · required
  - บรรทัดแสดงตัวเลขที่จะส่ง (จาก `measure()`) และ "จะรวมเข้ากับรายการเดิม" ถ้าใน run มี item ชื่อ
    เดียวกันหน่วยเดียวกันอยู่แล้ว — ต้องมี action `listOpenRunItems({projectId})` เล็ก ๆ คืน
    `{description, unit, reviewState}` เพื่อให้ prefill และเตือนได้ (โหลดครั้งเดียวตอนเปิดกล่อง)
  - ปุ่มหลักหนึ่งปุ่ม "ส่ง" · ยกเลิก · error ใต้ช่อง
- หลังส่งสำเร็จ: mark ถูกตั้ง `filed` ในเบราว์เซอร์ (ไม่ต้องรอโหลดใหม่) · สถานะแถบ "ส่งเข้าถอดปริมาณแล้ว HH:MM"

### 7.2 หน้า take-off (`(standard)/projects/[projectId]/takeoff/page.tsx`)
ในรายการ `measurement-list` ต่อบรรทัด เพิ่มป้าย `<span className="measurement-list__method">`
ข้อความ `QUANTITY_METHODS` label · ถ้า `methodNeedsDisclosure(method)` เพิ่ม class `--disclosed`
(วันนี้ไม่มีแถวไหนเข้าเงื่อนไข แต่โค้ดต้องพร้อม) · สไตล์ใช้โทเคนเดิม · responsive **หกความกว้าง**
360 640 721 761 1024 1440 เพราะหน้านี้ไม่ใช่หน้าวัดปริมาณ

## ขั้น 8 — `method-claims.ts` สองข้อ (ตามคำสั่งเจ้าของงาน)
1. title "ปิดหน้าเว็บแล้วเปิดใหม่ งานวัดยังอยู่ครบ" body: สเกล แนวเสา ระยะที่แบบเขียน และรอยวัด
   ทุกอันบันทึกไว้กับตัวตนของแบบใบนั้น เปิดไฟล์เดิมอีกครั้งงานทั้งหมดกลับมาที่จุดเดิม พร้อมชื่อคน
   ที่ยืนยันสเกล · provenBy `src/server/estimeter/drawing-repository.integration.test.ts`
2. title "ทุกปริมาณบอกได้ว่าได้มาอย่างไร" body: แต่ละบรรทัดใน backup sheet บอกว่าคนพิมพ์ คนชี้
   บนแบบ คนนับ หรือระบบไล่ห้องแล้วคนยืนยัน และค่าที่ปัญญาประดิษฐ์เสนอชี้กลับถึงรุ่นที่ตอบและคน
   ที่กดรับเสมอ ในระดับที่ฐานข้อมูลปฏิเสธเอง · provenBy `src/lib/quantity-provenance.test.ts`
- ถ้อยคำต้องผ่าน regex ของ `method-claims.test.ts` (ห้าม % ห้าม "เท่า" ห้ามคำราคา/สิทธิ์) ·
  title ไม่ซ้ำของเดิม · `appliesTo: ["estimeter"]`

## ขั้น 9 — ตรวจของจริงใน Edge (ต่อจาก IP-233 ขั้น 6)
1. หน้า 7 ของแบบกุสุมาลย์ สเกล 1:125 ที่ตั้งไว้แล้ว
2. วัดความยาวช่วง 5.00 ที่แบบเขียน → 5.00 · ไล่ห้องหนึ่งห้อง ยืนยัน · ปักหมุดนับสามจุด · ตั้งชื่อ
3. **ปิดแท็บ เปิดใหม่ เลือกไฟล์เดิม** → mark ทั้งสามกลับมาพร้อมชื่อและสี
4. ส่งความยาวเข้าถอดปริมาณ (หมวดโครงสร้าง) · ส่งห้อง (สถาปัตยกรรม ตร.ม.) · ส่งหมุด (หน่วย ตัว)
5. เปิดหน้า take-off → เห็นสาม item · กางดู backup sheet เห็นป้าย "คนชี้จุดบนแบบ" /
   "ระบบไล่ขอบห้อง คนยืนยัน" / "คนแตะนับทีละจุด" · ตัวเลขตรงกับหน้าวาดทุกหลัก
6. กลับหน้าวาด → mark ทั้งสามมีป้าย "ส่งแล้ว" ลบไม่ได้
7. ส่งความยาวอีกเส้นชื่อเดิม → item เดิม quantity รวม
8. ตรวจฐาน: `takeoff_measurements.method` สามค่า · `evidence_references.geometry` มี points และ
   `scale.metresPerPoint` · `takeoff_runs.document_id` ตั้งแล้ว
9. หน้า take-off หกความกว้าง ไม่มีเลื่อนแนวนอน · ล้าง emulation · คอนโซลไม่มี error

## ลำดับ commit
1. ขั้น 2 (กติกาหน่วย + เทสต์) 2. ขั้น 3+4 (สองไฟล์บริสุทธิ์ + เทสต์) 3. ขั้น 1 schema+generate
(**หยุดรายงานก่อน migrate**) 4. ขั้น 5 refactor Tx (เทสต์เดิมผ่านไม่แก้) 5. ขั้น 5.3 + integration
6. ขั้น 6 actions 7. ขั้น 7 หน้าจอ (commit หลังขั้น 9 ผ่าน) 8. ขั้น 8 claims

## ทางแยกที่จงใจไม่ทำรอบนี้ (บันทึกไว้ ไม่ต้องถาม)
ลบ measurement จากหน้า take-off แล้วปลดล็อก mark บนหน้าวาด (ทางกลับ) · เปลี่ยนหมวดของ item
ทีหลัง · แก้จุดของ mark ที่ส่งแล้ว · โครงการที่มีแบบหลายใบผูก run เดียว · เอกสารพิมพ์แยกวิธี (IP-109)
