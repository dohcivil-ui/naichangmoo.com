# ที่มาของทุกปริมาณ และงานวัดที่ไม่หายเมื่อปิดหน้าเว็บ — IP-232 · IP-233 · IP-234

**วันที่** 2026-09-02 (รอบสาม) · **ผู้ออกแบบ** Fable ตาม `AGENTS.md` ข้อ 2 · **สถานะ** ร่างรอเจ้าของงานเคาะ

แผนนี้ครอบสามรายการที่ต้องออกแบบเป็นก้อนเดียวกัน เพราะคอลัมน์ที่มาของปริมาณ (IP-232)
ต้องเกิดพร้อมตารางที่รายการวัดจะลง (IP-234) ไม่ใช่เติมทีหลัง — เจ้าของงานสั่งไว้ใน handoff
2026-09-02 หัวข้อเจ็ด: "ต้องออกแบบก่อนเริ่มก้อนมือถือ ไม่ใช่เติมทีหลัง"

| รายการ | คือ | ที่มา |
|---|---|---|
| **IP-232** | ทุกปริมาณเก็บ "วิธีที่ได้มา" ไม่ใช่ตีตราว่าแม่น | roadmap.json:1015 (planned) |
| **IP-233** (ขอเลขใหม่) | ตาราง `drawing_calibrations` — สเกล เส้นกริด ระยะจริง ลงฐาน | ก้อน 1 ของแผน `ocr-api-nested-dusk` (เลข IP-229 เดิมถูกใช้ไปกับเรื่องการนับแล้ว) |
| **IP-234** (ขอเลขใหม่) | รายการวัดจากหน้าวาดลงฐานข้อมูล พร้อมหลักฐานชี้กลับหน้าเดิม | ก้อน 3 ของแผนเดียวกัน |

---

## หนึ่ง — หลักการของ IP-232: เก็บข้อเท็จจริง ไม่เก็บคำพิพากษา

คำสั่งของเจ้าของงาน (handoff หัวข้อเจ็ด): *"ให้เก็บว่าปริมาณนั้นได้มาอย่างไร ไม่ใช่ตีตราว่า
แม่นหรือไม่แม่น ... วันที่ AI เก่งพอจึงแก้แค่เกณฑ์ ไม่ต้องแก้โครงสร้างข้อมูลและไม่ต้องย้ายข้อมูลเก่า"*

การออกแบบจึงแยกของสองชนิดออกจากกันเด็ดขาด

- **ข้อเท็จจริง** (ไม่มีวันเปลี่ยนความหมาย) → เป็นคอลัมน์ในฐานข้อมูล:
  วิธีที่ตัวเลขถูกผลิต · ใครยืนยัน เมื่อไหร่ · ถ้าโมเดลเสนอ — ชี้ไปที่บันทึกข้อเสนอฉบับเต็ม
- **คำพิพากษา** (เปลี่ยนได้เมื่อ AI เก่งขึ้น) → เป็นฟังก์ชันในโค้ด:
  วิธีไหนต้องแสดงแยกในตาราง วิธีไหนเข้าเอกสารพิมพ์ได้ — แก้ไฟล์เดียว ไม่มี migration

Precedent ในรีโปที่ยืนยันทางนี้: `boq_items.matchConfidence` (schema.ts:562) คือตัวอย่างของ
การฝังคำพิพากษาเป็นคอลัมน์ ซึ่งเราจะ**ไม่ทำซ้ำ** · ส่วน `assistant_proposals` (schema.ts:688)
เก็บ provenance ของ AI ครบอยู่แล้ว — `modelId` (รุ่นที่ตอบจริง แม้ failover), `promptHash`,
`decidedBy`, `decidedAt`, `changedFields` — เราจะ**ชี้กลับไปหามัน ไม่ลอกมันมาซ้ำ**

### 1.1 เปลี่ยน schema — `takeoff_measurements` (ALTER สามคอลัมน์ + หนึ่ง CHECK)

```
method       text NOT NULL          -- วิธีที่ตัวเลขถูกผลิต ค่าถูกต้องอยู่ในทะเบียนโค้ด
proposal_id  text NULL REFERENCES assistant_proposals(id) ON DELETE RESTRICT
method_context jsonb NULL           -- ข้อเท็จจริงประกอบ (version:1) เช่น ชนิด pointer, ชั้นอุปกรณ์
CHECK takeoff_measurements_model_pairs_proposal: (method = 'model') = (proposal_id IS NOT NULL)
```

- migration สามจังหวะ: เพิ่มคอลัมน์แบบ NULL ได้ → backfill แถวเดิมทั้งหมดเป็น `'typed'`
  (ทุกแถวที่มีอยู่มาจากฟอร์มพิมพ์มือจริง ๆ) → ตั้ง NOT NULL **ไม่ใส่ DEFAULT**
  เพื่อบังคับให้ทุกเส้นทางเขียนต้องประกาศวิธีเอง จะได้ไม่มีการติดป้ายผิดแบบเงียบ
- CHECK สองทิศ: ค่าจากโมเดล**ต้อง**ชี้ proposal (จึงย้อนถึงรุ่นโมเดลและคนกดรับได้เสมอ
  ระดับโครงสร้าง ไม่ใช่ระดับวินัย) และค่าที่ไม่ใช่โมเดล**ห้าม**ชี้ proposal
- `ON DELETE RESTRICT` — ห้ามลบข้อเสนอที่มีปริมาณอ้างอยู่ มิฉะนั้น provenance ขาดกลางอากาศ

### 1.2 ทะเบียนวิธี — ไฟล์ใหม่ `src/lib/quantity-provenance.ts`

ตามรูปทรง `platform_channels`: ฐานเก็บค่า ทะเบียนคีย์ที่ถูกต้องอยู่ในโค้ด มี contract test เฝ้า

| ค่า | ความหมาย (ข้อเท็จจริงล้วน) |
|---|---|
| `typed` | คนอ่านเลขจากแบบแล้วพิมพ์เอง — ฟอร์ม take-off เดิม และงานอ่านเลขบนมือถือในอนาคต |
| `pointer` | คนชี้จุดบนแบบในหน้าวาด — length / polyline / area / rect |
| `pointer_count` | คนแตะนับทีละจุด |
| `region_trace` | โค้ดไล่ขอบห้องเสนอรูป คนดูรูปทับแบบแล้วกดยืนยัน |
| `model` | โมเดลเสนอ คนกดรับผ่าน `settleProposal` — `proposal_id` บังคับ |

```ts
type QuantityMethod = "typed" | "pointer" | "pointer_count" | "region_trace" | "model";
QUANTITY_METHODS: Record<QuantityMethod, { label: string; description: string;
                                           requiresProposal: boolean }>
parseMethodContext(value: unknown): MethodContext | null   // jsonb ออกมาเป็น unknown เสมอ
type MethodContext = { version: 1; pointerType?: "mouse"|"pen"|"touch";
                       calibrationId?: string };
```

**ฟังก์ชันคำพิพากษา** (ที่เดียวที่แก้เมื่อ AI เก่งขึ้น): `disclosureFor(method)` คืนว่า
วิธีนั้นต้องแสดงแยกในตารางและเอกสารอย่างไร วันที่เกณฑ์เปลี่ยน แก้ฟังก์ชันนี้ + เทสต์ของมัน จบ

- อุปกรณ์ (แท็บเล็ตปากกา vs มือถือ) เป็นข้อเท็จจริงใน `method_context` **ไม่ใช่**ค่าใน `method`
  เพราะงานเดียวกัน (`typed`) ทำบนสองอุปกรณ์ได้และแม่นเท่ากัน — เจ้าของงานยืนยันเอง
- `drawing_calibrations.method` (หัวข้อสอง) ใช้หลักเดียวกัน: text + ทะเบียนในโค้ด

### 1.3 หน้าที่แสดงผล

ตารางวัดในหน้า take-off แสดงป้ายวิธีจาก `QUANTITY_METHODS[method].label` ทุกแถว
(ภาษาไทยจากทะเบียน ไม่มีชื่อช่องอังกฤษหลุดตาม G14) · เอกสารพิมพ์ยังติด IP-109/`document_releases`
ที่ยังไม่มี — บันทึกหน้าที่นี้ไว้ในแผน ไม่ทำรอบนี้

### 1.4 เทสต์ที่เฝ้า

1. ทะเบียนกับ CHECK ตรงกัน — เดินทะเบียน: ทุกค่า `requiresProposal:true` ต้องเป็นค่าที่ CHECK บังคับ
2. integration (`ESTIMETR_DB_TESTS=1`): insert `method='model'` โดยไม่มี `proposal_id` → ฐานปฏิเสธ ·
   insert `method='typed'` พร้อม `proposal_id` → ฐานปฏิเสธ
3. repository ปฏิเสธ `method` นอกทะเบียนก่อนถึงฐาน
4. เทสต์ไม่ถดถอย: เส้นทางฟอร์มเดิม (`addTakeoffMeasurement`) เขียน `method:'typed'` เสมอ

### 1.5 ADR

เรื่องนี้เข้าเกณฑ์ทั้งสามด่าน (ย้อนยาก · แปลกใจถ้าไม่รู้บริบท · แลกจริง — การถามว่า
"แม่นไหม" ต้องผ่านโค้ด ถามตรงจากฐานไม่ได้) → **ADR 0024: ปริมาณเก็บวิธีที่ได้มา
ไม่เก็บคำตัดสินว่าแม่น** ใช้เลขถัดไปตามกติกา `.agent/commands/adr.md`
(เรื่อง "ภาพแบบออกนอก" ที่แผนแม่เคยเอ่ยถึงเลข 0024 ยังไม่ถูกเขียน จะได้เลขถัดไปเมื่อเขียนจริง)

---

## สอง — IP-233: ตัวตนของเอกสาร และตาราง `drawing_calibrations`

### 2.1 ตัวตนของเอกสารโดยยังไม่มีที่เก็บไฟล์

วันนี้ PDF เปิดจาก `<input type="file">` เหลือตัวตนแค่ชื่อไฟล์ · `drawing_documents`
(schema.ts:205) มีครบแต่ไม่มีโค้ดใช้ · R2 รอเจ้าของงานรัน setup

**ทางที่เสนอ**: เบราว์เซอร์คำนวณ SHA-256 จาก `ArrayBuffer` ที่มีอยู่แล้วใน `openFile()`
(`crypto.subtle.digest` — ไม่มีไบต์ไหนออกจากเครื่อง) → server action upsert แถว
`drawing_documents` ด้วย `(projectId, checksum)` → ได้ `documentId` ให้ทุกตารางชี้

- `storage_key` เป็น NOT NULL อยู่แล้ว → ใช้ค่า **`unstored:<checksum>`** ตรงไปตรงมาว่า
  ไบต์ยังอยู่เครื่องผู้ใช้ ไม่ต้องแก้ schema · วันที่ R2 มา UPDATE ค่าเดียวจบ
- **ไม่เพิ่มคอลัมน์ชื่อไฟล์** — ชื่อไฟล์ลูกค้าอาจมีข้อมูลส่วนบุคคล และ checksum คือตัวตน
  ของรุ่นแบบตามที่ `estimeter-operating-policy.md:13` นิยามไว้แล้ว
- เอกสารเดียวกันเปิดใหม่ → checksum เดิม → งานเดิมทั้งหมดกลับมา นี่คือกลไก "ปิดแล้วไม่หาย" ทั้งก้อน

### 2.2 ตารางใหม่ `drawing_calibrations`

```
id                  text PK
document_id         text NOT NULL → drawing_documents ON DELETE CASCADE
page_number         integer NOT NULL          UNIQUE(document_id, page_number)
metres_per_point    numeric(18,12) NOT NULL   CHECK > 0
method              text NOT NULL             -- 'two_point' | 'stated_dimension' (ทะเบียนโค้ด)
reference_geometry  jsonb NOT NULL            -- {version:1, points:[a,b], realDistance, unit}
grid                jsonb NULL                -- {version:1, lines: DraftedGridLine[]} · null = ยังไม่ร่าง
dimensions          jsonb NULL                -- {version:1, items: StatedDimension[]}
confirmed_by        text NOT NULL → users
confirmed_at        timestamp NOT NULL
created_at / updated_at
```

- `confirmed_by NOT NULL` — ไม่มีเส้นทางไหนแม้แต่ SQL มือที่สเกลลงฐานได้โดยไม่มีชื่อคน
  (ADR 0019 + IP-052 กลายเป็นโครงสร้าง ตามแผนแม่)
- **ไม่เก็บ `ratio`** — คำนวณได้จาก `metresPerPoint` เสมอ (`drawing-scale.ts:96`)
  ค่าที่คำนวณได้แล้วเก็บซ้ำคือค่าค้างรอวันขัดกัน (ต่างจากร่างแผนแม่ที่มีคอลัมน์นี้ — จงใจตัด)
- `grid` เก็บเฉพาะสิ่งที่คนป้อน (`id, page, a, b, label?`) — ชื่ออัตโนมัติและจุดตัด
  คำนวณใหม่เสมอ ตามกติกาหัวไฟล์ `drawing-grid.ts:8-10`
- `dimensions` เก็บระยะจริงทุกตัวของหน้า (หน่วยเมตรเสมอ ตาม `StatedDimension`)
  ค่าความต่าง stated/measured คำนวณสดด้วย `dimensionDisagreement()` ไม่เก็บ
- jsonb ทุกช่องมี `version:1` เพราะ jsonb ไม่มี migration · อ่านกลับผ่าน parse function เสมอ
- แถวเกิด **ณ วินาทีที่คนยืนยันสเกลครั้งแรก** ของหน้านั้น (กริดที่ร่างก่อนยืนยันสเกล
  ยังอยู่ในเบราว์เซอร์จนถึงตอนนั้น — หน้าต่างเสี่ยงแคบ เพราะลำดับงานจริงคือ
  ร่างกริด → ระยะจริง → สเกลถูกยืนยันในจังหวะเดียวกัน) หลังจากนั้นการแก้กริด/ระยะจริง
  UPDATE แถวเดิม
- เพิ่ม `drawingCalibrations` เข้า `CLOSED_TABLES` (`closed-tables.test.ts:16`)

### 2.3 ฝั่งเซิร์ฟเวอร์และไคลเอนต์

- ไฟล์ใหม่ `src/server/estimeter/drawing-repository.ts` ตามแบบ `takeoff-repository.ts` ทุกประการ:
  transaction + audit row ในก้อนเดียว · `WriteResult<T>` · org-scope ผ่าน join `projects`
  - `registerDocument({organizationId, projectId, actorId, checksum, mimeType, byteSize, pageCount})`
  - `saveCalibration({..., documentId, pageNumber, metresPerPoint, method, referenceGeometry,
    grid, dimensions, actorId})` — insert ครั้งแรก / update ครั้งถัดไป
  - `loadDrawingState({organizationId, projectId, documentId})` — calibrations ทุกหน้า
- ไฟล์ใหม่ `src/server/actions/estimeter-drawing.ts` ตามแบบ `estimeter-takeoff.ts`:
  `requireEditAccess()` เดิมทุกบรรทัด แต่รับ JSON ผ่านอาร์กิวเมนต์ตรง (ไม่ใช่ FormData —
  หน้าวาดส่งพิกัดเป็นก้อน ไม่ใช่ฟอร์ม) · เรียกจาก client ด้วย `startTransition`
- `markup/page.tsx` ส่งเพิ่ม `projectId` (มีอยู่แล้วฝั่งเซิร์ฟเวอร์ แค่ไม่เคยส่ง)
- `drawing-markup.tsx`:
  - `openFile()` คำนวณ checksum → เรียก register → เก็บ `documentId` ใน state →
    โหลด state ที่เคยบันทึก → เติม `scales/gridLines/dimensions`
  - จุดเซฟ = ทุกจังหวะยืนยันของคน: `applyCalibration` · `saveDimension` ·
    วางเส้นกริด/ลบเส้นกริด (หลังมีสเกลแล้ว) — ไม่มี autosave ตามเวลา ไม่มีการเซฟร่างที่ยังไม่ยืนยัน
  - **แก้บั๊กเดิมพร้อมกัน**: `openFile` ล้าง `gridLines`/`dimensions` ด้วย
    (ตอนนี้ล้างแค่ scales/measurements — เส้นกริดของไฟล์เก่าค้างข้ามไฟล์)

---

## สาม — IP-234: รายการวัดลงฐานข้อมูล พร้อมหลักฐานชี้กลับหน้าเดิม

### 3.1 ก้อน 2 ของแผนแม่ต้องมาก่อนครึ่งตัว — `src/lib/drawing-evidence.ts`

`evidence_references.geometry` (jsonb ว่างมาตลอด) ต้องมี union เดียวที่ทุกฝั่งใช้
ตามร่างแผนแม่ก้อน 2:

```ts
type EvidenceGeometry =
  | { kind:"measurement"; version:1; page:number; measurementKind: MeasurementKind;
      points: PagePoint[]; scale:{ metresPerPoint:number } };  // ก๊อปสเกล ณ ตอนยืนยัน
```

(สมาชิก union ตัวอื่นของแผนแม่ — grid-node, text-span — ยังไม่เพิ่มจนกว่าก้อนของมันมาถึง)
พร้อม `parseEvidenceGeometry(value: unknown)` เพราะทุกอย่างที่ออกจาก jsonb คือ `unknown` ·
สเกลถูกก๊อปเข้าไปด้วยเหตุผลเดียวกับที่ `conversionNote` ถูกบังคับด้วย CHECK —
ค่าที่อธิบายตัวเองไม่ได้ ห้ามอยู่กลางการคำนวณ

### 3.2 สะพาน — ไฟล์ใหม่ `src/lib/takeoff-from-measurement.ts` (บริสุทธิ์ ไม่แตะฐาน)

`Measurement` + `PageScale` → `{ item: {description, unit}, measurement: MeasurementInput,
evidence: {pageNumber, geometry} , method: QuantityMethod }`

- `method` มาจากชนิดเครื่องมือ: length/polyline/area/rect → `pointer` · count → `pointer_count` ·
  room → `region_trace`
- หน่วยจับคู่ผ่านทะเบียน `takeoff-units.ts` ที่มีอยู่: ความยาว → เมตร · พื้นที่ → ตารางเมตร ·
  นับ → หน่วยนับ (รหัสจริงตามทะเบียน)
- ตัวเลขในแถว measurement ต้องเท่ากับ `MeasurementValue` ที่จอคำนวณ — มีเทสต์เทียบตรง
- **จุดที่ผู้ลงมือต้องหยุดถ้าไม่ลงตัว**: `measurementMatchesUnit()` ตัดสินจำนวน dimension
  ตามหน่วย ถ้าหน่วยพื้นที่เรียกร้องสอง dimension แต่รูปหลายเหลี่ยมมีแค่ค่าพื้นที่เดียว
  ให้หยุดส่งกลับมาที่ผู้วางแผน ห้ามแก้ทะเบียนหน่วยเองที่หน้าคีย์บอร์ด (AGENTS.md ข้อ 2)

### 3.3 เส้นทางเขียน

- ใช้ `startManualRun` เดิม (มี `documentId` nullable รออยู่แล้ว — เติมให้มัน) →
  ต่อหนึ่งการวัดที่คนยืนยัน: item + measurement (พร้อม `method`) + evidence
  (พร้อม `documentId`, `pageNumber`, `geometry`) ในธุรกรรมเดียว
- ขยาย `addItemEvidence` (`takeoff-repository.ts:764`) ให้รับและเขียน `documentId` + `geometry`
  ที่วันนี้ทิ้ง NULL — จุดแตะเดียวของโค้ดเดิม เส้นทางฟอร์มเก่าส่ง null เหมือนเดิมทุกไบต์
  (มีเทสต์ไม่ถดถอยเทียบอาร์กิวเมนต์)
- ความละเอียดของ item (หนึ่งการวัด = หนึ่ง item หรือรวมกลุ่มตามชื่อ) — **รอเจ้าของงานเคาะ**
  ดูคำถามท้ายแผน · ค่าเริ่มต้นที่เสนอ: หนึ่งการวัด = หนึ่ง item สถานะ `proposed`
  (ทางอัปเกรดสู่การรวมกลุ่มเปิดอยู่เพราะ `recomputeItemQuantity` รวมหลาย measurement ต่อ item ได้แล้ว)
- ห้องจาก `region_trace` ยังต้องผ่านการกดยืนยันบนจอเหมือนเดิมก่อนถึงจุดเซฟ —
  ด่านคนดูรูป (`pendingRoom` → `confirmRoom`) ไม่เปลี่ยน

### 3.4 เส้นทางอ่านกลับ

เปิดไฟล์ → checksum → `documentId` → โหลด calibrations (สเกล กริด ระยะจริง) +
evidence ทั้งเอกสาร → `parseEvidenceGeometry` → ประกอบ `Measurement[]` กลับขึ้นจอ
พร้อมชื่อและสีเดิม → รายการวัดและภาพทับบนแบบเหมือนก่อนปิดหน้าเว็บ

### 3.5 จุดขายลง `method-claims.ts` (รอบเดียวกัน ตามคำสั่ง)

1. **"ปิดหน้าเว็บแล้วเปิดใหม่ งานวัดยังอยู่ครบ"** — สเกล เส้นกริด ระยะจริง และรายการวัด
   ลงฐานข้อมูลพร้อมชื่อคนยืนยัน · provenBy: เทสต์ integration ของ drawing-repository
2. **"ทุกปริมาณบอกวิธีที่ได้มา"** — ค่าที่โมเดลเสนอชี้กลับถึงรุ่นโมเดลและคนที่กดรับเสมอ
   ระดับโครงสร้างฐานข้อมูล · provenBy: เทสต์ CHECK ของ quantity-provenance
   (ถ้อยคำจริงต้องผ่านด่าน regex ของ `method-claims.test.ts` — ห้ามเปอร์เซ็นต์ ห้ามคำเชิงราคา)

---

## สี่ — ลำดับ commit ที่เสนอ

1. `src/lib/quantity-provenance.ts` + เทสต์ (บริสุทธิ์ ยังไม่แตะฐาน)
2. ADR 0024 + migration IP-232 (สามคอลัมน์ + CHECK + backfill) + แก้เส้นทางฟอร์มเดิมให้ส่ง `typed`
3. migration IP-233 (`drawing_calibrations`) + `drawing-repository.ts` + integration test + CLOSED_TABLES
4. `drawing-evidence.ts` + `takeoff-from-measurement.ts` + เทสต์ (บริสุทธิ์)
5. server actions + ต่อ `drawing-markup.tsx` (checksum, save, reload) + แก้บั๊ก `openFile`
6. ป้ายวิธีในตารางวัดหน้า take-off
7. method-claims สองข้อ + เทสต์
8. ตัดรุ่นเมื่อกดจริงผ่านครบ (roadmap + CHANGELOG + handoff ตามกติกาข้อ 8)

## ห้า — วิธีพิสูจน์

- `pnpm lint` `pnpm typecheck` `pnpm test` เขียว · `ESTIMETR_DB_TESTS=1` integration ผ่าน ·
  `pnpm db:generate` แล้ว migration ถูก apply จริง
- กดจริงใน Edge บน `km/kusumal_hospital/` หน้า 7: ร่างกริด → ระยะจริง 5.00 ม. → สเกล 1:125 →
  วัดช่วงถัดไปต้องได้ 5.00 (เทียบเลขที่แบบเขียนเสมอ) → **ปิดแท็บ เปิดใหม่ เลือกไฟล์เดิม →
  สเกล กริด ระยะจริง และรายการวัดกลับมาครบ** → ภาพหน้าจอทุกขั้น · คอนโซลไม่มี error
- แถวในฐานตรวจด้วยตา: measurement มี `method` ถูกต้อง · evidence มี `documentId+geometry` ·
  calibration มี `confirmed_by`
- responsive: หน้าวาดที่ 820×1180 ขึ้นไป · หน้า take-off (standard group ถูกแตะ) ครบหกความกว้าง
  360 640 721 761 1024 1440 ไม่มีการเลื่อนแนวนอน

## หก — คำตัดสินของเจ้าของงาน (เคาะแล้ว 2026-09-03)

### 6.1 รูปทรงของบรรทัด — เป็น backup sheet

เจ้าของงานอธิบายเองว่า *"คล้าย ๆ การทำ backup sheet แยกย่อยทีละจุด ชี้ที่มาที่ไปได้
สุดท้ายค่อยไปสรุปแล้วส่งยอดรวมขึ้น ปร.4"* — ตรงกับสองชั้นที่ตารางมีอยู่แล้วพอดี

- **บรรทัดวิธีคิด** (`takeoff_measurements`) = backup sheet · หนึ่งการวัดบนแบบ = หนึ่งแถวที่นี่
  พร้อม `evidence_references` ที่ชี้กลับไปหน้าและพิกัดบนแบบ (นี่คือ "ชี้ที่มาที่ไปได้")
- **บรรทัดรายการ** (`takeoff_items`) = ยอดที่ขึ้นใบ ปร.4 · ปริมาณเป็นผลรวมที่
  `recomputeItemQuantity` บวกให้เอง ไม่ใช่เลขที่พิมพ์เอง
- การวัดที่ตั้งชื่อเหมือนกันรวมลงบรรทัดรายการเดียวกัน — **ชื่อที่ผู้ใช้พิมพ์คือตัวจัดกลุ่ม**

**ผลต่อ `takeoff-from-measurement.ts`** สะพานต้องคืนทั้งคู่: แถว measurement เสมอ
บวกกับ "ควรไปอยู่ใต้บรรทัดรายการชื่ออะไร" ไม่ใช่สร้างบรรทัดรายการใหม่ทุกครั้ง

### 6.2 กลับมาอยู่จุดเดิม — ข้อกำหนดใหม่ที่แผนเดิมไม่ได้ครอบ

เจ้าของงานสั่งเพิ่ม *"เช็คอินจุดไหน เปิดมาใหม่ก็เจอจุดนั้น ไม่ใช่เริ่มใหม่หมด"*
— การมีข้อมูลครบแต่เด้งกลับหน้า 1 ซูมเริ่มต้น **ยังไม่ถือว่าผ่านข้อนี้**

ต้องเก็บเพิ่ม: หน้าที่เปิดค้าง · ตำแหน่งที่เลื่อนไป · ระดับซูม (`view` ที่ `drawing-markup.tsx:255`)

- **เป็นของส่วนตัวรายคน ไม่ใช่งานที่แชร์** คนสองคนเปิดแบบใบเดียวกันคนละจุดได้
  จึงคีย์ด้วย (ผู้ใช้ + เอกสาร) ไม่ใช่เอกสารอย่างเดียว — **ห้ามเอาไปยัดใน
  `drawing_calibrations`** ซึ่งเป็นงานร่วมของเอกสาร ไม่ใช่ตำแหน่งสายตาของใครคนหนึ่ง
- เขียนบ่อยกว่าของอื่นมาก (ทุกครั้งที่เลื่อนจอ) → หน่วงการเขียนแล้วเขียนครั้งเดียว
  และ**ห้ามลง `audit_events`** เพราะการเลื่อนจอไม่ใช่การกระทำที่ต้องตรวจสอบย้อนหลัง
  ถ้าลงจะกลบเหตุการณ์จริงจนหาไม่เจอ
- **ร่างที่ยังไม่กดยืนยันไม่กลับมา** (รูปห้องที่ลากค้างครึ่งรูป) เพราะยังไม่ใช่ข้อมูล
  แต่ตำแหน่งที่ยืนอยู่กลับมาครบ ผู้ใช้ลากใหม่ได้ทันทีโดยไม่ต้องหาห้องนั้นใหม่

### 6.3 ตัวตนของเอกสาร — ใช้ hash ฝั่งเบราว์เซอร์ ไม่รอ R2

เหตุผลที่ชี้ขาด: **phase 1 ยังไม่เปิดให้ทำงานเป็นทีม** (เจ้าของงานยืนยัน 2026-09-03)
เหตุผลหลักที่ต้องรีบมี R2 คือให้เพื่อนร่วมทีมเปิดแบบใบเดียวกันต่อได้ ซึ่งยังไม่ต้องใช้ในเฟสนี้
· ข้อแลกที่บันทึกไว้: ผู้ใช้ยังต้องเก็บไฟล์ PDF ไว้ในเครื่องเอง เพราะภาพแบบมาจากไฟล์ของเขา
ตัวเลขที่วัดปลอดภัยในฐานแล้ว · วันที่รัน `setup-r2.sh` เสร็จ แก้ `storage_key` ช่องเดียว

**ศัพท์** ห้ามเขียนคำว่า "ลายนิ้วมือ" ในเอกสารหรือโค้ด เป็นคำเปรียบเทียบตอนอธิบายเท่านั้น
คำมาตรฐานคือ hash / checksum / digest · คอลัมน์ในฐานชื่อ `checksum` อยู่แล้ว ใช้คำนั้น
