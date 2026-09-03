# ขั้นลงมือ IP-233 — เปิดไฟล์แล้วรู้จักตัวตน เซฟสเกล กริด ระยะจริง และจุดที่ค้าง

**ผู้วางแผน** Fable · **ผู้ลงมือ** builder (Opus 5) · **แผนแม่** `2026-09-02-quantity-provenance-and-persistence.md`
**สถานะตั้งต้น** commit `66f8656` — migration 0015 รันกับฐานแล้ว ตารางพร้อม ยังไม่มีโค้ดเขียนลงไป

สเปกนี้ตัดสินใจครบทุกทางแยกแล้ว **ถ้าเจอทางแยกที่ไม่ได้เขียนไว้ ให้หยุดแล้วส่งกลับ ไม่ตัดสินเอง**
(AGENTS.md ข้อ 2) · ทุกขั้นต้องผ่าน `pnpm lint` `pnpm typecheck` `pnpm test` ก่อน commit ·
commit message ภาษาไทย มี `(IP-233)` ท้ายบรรทัดแรก · ห้าม push

**ศัพท์** ใช้คำสากลทับศัพท์ในโค้ดและคอมเมนต์ (checksum, migration, foreign key) ห้ามแปลเป็นชื่อไทยเอง
· ข้อความที่ผู้ใช้เห็นเป็นไทยล้วน ไม่มีชื่อช่องอังกฤษหลุด (G14) · ไม่มี emoji

---

## ขั้น 1 — `src/lib/drawing-state.ts` + เทสต์ (ไฟล์คำนวณล้วน)

รูปทรงของ jsonb สี่ช่อง ทุกตัวมี `version: 1` ตายตัว และ parser ที่รับ `unknown` คืน `T | null`
(เหตุผลเดียวกับ `parseMethodContext` ใน `quantity-provenance.ts` — ทุกอย่างที่ออกจาก jsonb คือ `unknown`)

```ts
import type { PagePoint, ScaleUnit, StatedDimension } from "@/lib/drawing-scale";
import type { DraftedGridLine } from "@/lib/drawing-grid";

export type CalibrationReference = { version: 1; a: PagePoint; b: PagePoint; realDistance: number; unit: ScaleUnit };
export type GridPayload        = { version: 1; lines: DraftedGridLine[] };
export type DimensionsPayload  = { version: 1; items: StatedDimension[] };
export type ViewPayload        = { version: 1; scale: number; x: number; y: number };

export function parseCalibrationReference(value: unknown): CalibrationReference | null;
export function parseGridPayload(value: unknown): GridPayload | null;
export function parseDimensionsPayload(value: unknown): DimensionsPayload | null;
export function parseViewPayload(value: unknown): ViewPayload | null;
```

กติกา parser: ตัวเลขทุกตัวต้อง `Number.isFinite` · `id` เป็น string ไม่ว่าง · `page` เป็นจำนวนเต็ม ≥ 1 ·
`unit` ต้องอยู่ใน `"m" | "cm" | "mm"` · `realDistance > 0` · `valueM > 0` · `label` ของ grid line
ถ้ามีต้องเป็น string · `lines`/`items` ที่มีสมาชิกผิดรูปแม้ตัวเดียว → คืน `null` ทั้งก้อน (ไม่กรองทิ้งเงียบ)
· ไม่ยกช่องที่ไม่รู้จักติดมา

เทสต์: round-trip ของแต่ละชนิด · ปฏิเสธ version ผิด · ปฏิเสธเลขไม่ finite · ปฏิเสธ unit นอกรายการ ·
ปฏิเสธเมื่อสมาชิกใน array ผิดรูปหนึ่งตัว · ช่องแปลกปลอมไม่ติดมา

## ขั้น 2 — ย้าย `requireEditAccess` ออกมาเป็นโมดูลกลาง

ไฟล์ใหม่ `src/server/estimeter/edit-access.ts` (ไม่มี `"use server"` เพราะไฟล์นั้น export ได้แค่ async function
และไฟล์นี้ต้อง export type ด้วย) · ย้าย `EditContext` กับ `requireEditAccess` จาก
`src/server/actions/estimeter-takeoff.ts:60-92` มาทั้งก้อน **ไม่แก้พฤติกรรมสักบรรทัด** ข้อความไทยเดิมทุกตัว ·
`estimeter-takeoff.ts` import กลับมาใช้ · เทสต์เดิมของ actions ต้องผ่านเหมือนเดิม

## ขั้น 3 — `src/server/estimeter/drawing-repository.ts` + เทสต์ integration

ลอกรูปทรง `takeoff-repository.ts` ทุกประการ: ทุก write เป็น `getDb().transaction` · คืน `WriteResult<T>` ·
scope องค์กรด้วย join `projects` (คอมเมนต์ที่ `:85-89` อธิบายว่าทำไมข้ามไม่ได้) · audit row ในธุรกรรมเดียว

```ts
export type DrawingWriteRejection =
  | "project_not_found" | "project_not_writable" | "document_not_found" | "invalid_payload";
export type WriteResult<T> = { ok: true; value: T } | { ok: false; reason: DrawingWriteRejection };
```

### 3.1 `registerDrawingDocument`
```ts
({ organizationId, projectId, actorId, checksum, mimeType, byteSize, pageCount: number | null })
  → WriteResult<{ documentId: string; created: boolean }>
```
- ล็อกแถว `projects` ด้วย `.for("update")` scope org เหมือน `startManualRun:250-256` ·
  ไม่เจอ → `project_not_found` · state ไม่อยู่ใน `WRITABLE_PROJECT_STATES` (draft, active) → `project_not_writable`
- select `drawingDocuments` where `projectId` + `checksum` → เจอคืน `{documentId, created:false}` **ไม่ลง audit**
  เพราะไม่มีอะไรเปลี่ยน
- ไม่เจอ → insert `{ id: randomUUID(), projectId, storageKey: \`unstored:${checksum}\`, checksum, mimeType,
  byteSize, pageCount, scanState: "pending" }` + audit `eventType: "drawing.document_registered"`,
  `resourceType: "drawing_document"`, `metadata: { projectId, checksum, byteSize, pageCount }`
- **ห้ามเก็บชื่อไฟล์** ที่ไหนทั้งสิ้น (แผนแม่ 2.1)

### 3.2 `saveCalibration`
```ts
({ organizationId, documentId, actorId, pageNumber, metresPerPoint, method, reference, grid, dimensions })
  → WriteResult<{ calibrationId: string }>
// reference: CalibrationReference · grid: DraftedGridLine[] · dimensions: StatedDimension[]
```
- ตรวจก่อนแตะฐาน: `isCalibrationMethod(method)` · `Number.isFinite(metresPerPoint) && > 0` ·
  `Number.isInteger(pageNumber) && >= 1` · ทุก grid line และ dimension มี `page === pageNumber` ·
  ผิดข้อใด → `invalid_payload`
- scope: select `drawingDocuments` join `projects` filter org, `.for("update")` บนแถว document ·
  ไม่เจอ → `document_not_found` · project ไม่ writable → `project_not_writable` ·
  `pageCount` ไม่ null และ `pageNumber > pageCount` → `invalid_payload`
- upsert ด้วยมือ: select ที่ `(documentId, pageNumber)` → มี: `update` ทุกช่อง +
  `confirmedBy: actorId, confirmedAt: now, updatedAt: now` · ไม่มี: insert
- เก็บ `grid` เป็น `{version:1, lines}` (grid ว่าง → เก็บ `null` ไม่ใช่ `{lines:[]}`) ·
  `dimensions` เป็น `{version:1, items}` (ว่าง → `null`) · `referenceGeometry` = reference ตรง ๆ ·
  `metresPerPoint` ส่งเป็น `String(metresPerPoint)` เพราะคอลัมน์ numeric รับ string
- audit `"drawing.calibration_saved"` resourceType `"drawing_calibration"` metadata
  `{ documentId, pageNumber, method, metresPerPoint, gridLines: grid.length, dimensions: dimensions.length, replaced: boolean }`

### 3.3 `loadDrawingState`
```ts
({ organizationId, documentId, userId })
  → { calibrations: PageCalibrationView[]; view: { pageNumber: number; view: ViewPayload } | null } | null
export type PageCalibrationView = { id: string; pageNumber: number; metresPerPoint: number;
  method: CalibrationMethod; reference: CalibrationReference | null;
  grid: DraftedGridLine[]; dimensions: StatedDimension[]; confirmedAt: Date };
```
- document ไม่อยู่ใน org → `null` (ไม่ใช่ array ว่าง — สองอย่างนี้คนละความหมาย)
- `metresPerPoint` ออกจาก pg เป็น string → `Number()` · jsonb ผ่าน parser ของขั้น 1 ·
  parse ไม่ผ่าน → `reference: null`, `grid: []`, `dimensions: []` **แต่แถวยังคืน** เพราะสเกลเป็นคอลัมน์
  ที่ถูกต้องเสมอ · `method` ที่ไม่อยู่ในทะเบียน → ข้ามแถวนั้น
- view: select `drawingViewStates` ที่ `(userId, documentId)` → parse → ไม่ผ่านคืน `null`
- เรียงตาม `pageNumber`

### 3.4 `saveViewState`
```ts
({ organizationId, userId, documentId, pageNumber, view: ViewPayload }) → WriteResult<void>
```
- ตรวจ `pageNumber` จำนวนเต็ม ≥ 1 · `view` ทุกเลข finite · `scale > 0` → ผิด `invalid_payload`
- scope org ผ่าน join projects (ไม่ต้องล็อก) · ไม่เจอ → `document_not_found`
- upsert ที่ `(userId, documentId)` ด้วยมือเหมือน 3.2
- **ไม่มี audit row** — เหตุผลอยู่ในคอมเมนต์ของตาราง `drawingViewStates` ใน schema.ts ให้ยกมาอ้าง

### 3.5 เทสต์ `drawing-repository.integration.test.ts`
ลอก `loadLocalEnv` + `createProjectFixture` + `afterAll` cleanup จาก `takeoff-repository.integration.test.ts:1-80`
(organizations cascade ลง drawing_documents → calibrations → view_states แล้ว · audit ลบแยกเหมือนเดิม) ·
`describe.skipIf(!enabled)` เหมือนเดิม

ต้องมีอย่างน้อย:
1. register สองครั้ง checksum เดิม → `documentId` เดิม, `created` เป็น true แล้ว false, audit row **หนึ่ง**แถว
2. checksum ต่างกัน → คนละ id
3. project ของอีก org → `project_not_found`
4. saveCalibration ครั้งแรก insert ครั้งสอง update หน้าเดิม → นับแถวใน `drawingCalibrations` ได้ 1,
   `confirmedBy` เป็น actor คนหลัง, audit สองแถว แถวหลัง `replaced: true`
5. `metresPerPoint: 0` → repo คืน `invalid_payload` (ไม่ถึงฐาน) · และ insert ตรงเลี่ยง repo ด้วย
   `"0"` → ฐานปฏิเสธด้วย `drawing_calibrations_metres_per_point_positive` (ลอก `refusedBy` helper)
6. `method: "guess"` → `invalid_payload`
7. grid line ที่ `page` ไม่ตรง `pageNumber` → `invalid_payload`
8. load คืน grid/dimensions ที่ parse แล้วเท่ากับที่เซฟ · load จากอีก org → `null`
9. saveViewState สองครั้ง → หนึ่งแถว ค่าเป็นครั้งหลัง · **นับ audit_events ของ org ก่อนหลังต้องเท่ากัน**
10. insert `drawingCalibrations` ตรงโดยไม่ใส่ `confirmedBy` → ฐานปฏิเสธ (NOT NULL) — พิสูจน์ประโยค
    "ไม่มีเส้นทางไหนแม้แต่ SQL มือ" ของแผนแม่

รันด้วย `ESTIMETR_DB_TESTS=1 pnpm vitest run src/server/estimeter/drawing-repository.integration.test.ts`
ต้องเห็นผ่านจริง ไม่ใช่ skipped

## ขั้น 4 — `src/server/actions/estimeter-drawing.ts` (`"use server"`)

สี่ action รับ JSON ตรง (ไม่ใช่ FormData — หน้าวาดส่งพิกัดเป็นก้อน) ทุกตัวเริ่มด้วย
`requireEditAccess()` จากขั้น 2 · **ตรวจ input ฝั่งเซิร์ฟเวอร์ซ้ำทุกตัว** ห้ามเชื่อ client

```ts
export type DrawingActionResult<T> = ({ ok: true } & T) | { ok: false; message: string };

registerDrawing({ projectId, checksum, mimeType, byteSize, pageCount }) → DrawingActionResult<{ documentId }>
  // checksum ต้อง /^[a-f0-9]{64}$/ · byteSize จำนวนเต็ม > 0 · pageCount จำนวนเต็ม ≥ 1 หรือ null
  // mimeType ต้องเป็น "application/pdf" เท่านั้น (รอบนี้รับแค่ PDF)
saveDrawingCalibration({ documentId, pageNumber, metresPerPoint, method, reference, grid, dimensions })
  → DrawingActionResult<{ calibrationId }>
  // reference/grid/dimensions ผ่าน parser ขั้น 1 ก่อนส่ง repo — parse ไม่ผ่านตอบ message ไทย
loadDrawing({ documentId }) → DrawingActionResult<{ state: DrawingStateView }>
  // repo คืน null → message "ไม่พบแบบใบนี้ในโครงการของคุณ"
saveDrawingView({ documentId, pageNumber, view }) → DrawingActionResult<Record<never, never>>
```

ตาราง message ไทยของ `DrawingWriteRejection` แบบเดียวกับ `rejectionMessage` ใน estimeter-takeoff.ts:45:
- `project_not_found` → "ไม่พบโครงการนี้ในองค์กรของคุณ"
- `project_not_writable` → "โครงการนี้อยู่ในสถานะที่แก้ไขไม่ได้"
- `document_not_found` → "ไม่พบแบบใบนี้ในโครงการของคุณ"
- `invalid_payload` → "ข้อมูลที่ส่งมาไม่ครบหรือผิดรูป บันทึกไม่ได้"

ไม่ต้อง `revalidatePath` — ยังไม่มีหน้าฝั่งเซิร์ฟเวอร์ที่แสดงของพวกนี้

## ขั้น 5 — ฝั่งหน้าจอ

### 5.1 `markup/page.tsx`
ส่ง `projectId={projectId}` เพิ่มหนึ่ง prop · แก้คอมเมนต์หัวไฟล์ย่อหน้าสุดท้าย ("รอบนี้แบบยังไม่ถูกส่งขึ้น
ที่เก็บไฟล์…") ให้ตรงความจริงใหม่: ไฟล์ยังอยู่เครื่องผู้ใช้ แต่งานวัดลงฐานแล้วผ่าน checksum

### 5.2 `drawing-markup.tsx`

**props** `{ projectName; projectHref; projectId }`

**state ใหม่**
```ts
const [documentId, setDocumentId] = useState<string | null>(null);
/** วิธีและจุดอ้างอิงที่ใช้ตั้งสเกลของแต่ละหน้า ต้องส่งซ้ำทุกครั้งที่เซฟหน้านั้น */
const [references, setReferences] = useState<Record<number, { method: CalibrationMethod; reference: CalibrationReference }>>({});
const [saveStatus, setSaveStatus] = useState<{ kind: "idle" | "saving" | "saved" | "failed"; at?: Date; message?: string }>({ kind: "idle" });
const hydratingRef = useRef(false);            // true ระหว่างยกของเก่าขึ้นจอ กัน effect เซฟย้อนกลับ
const lastSavedRef = useRef<Record<number, string>>({}); // ลายเซ็นของหน้าที่เซฟล่าสุด
```

**`openFile` แก้ตามนี้ ลำดับสำคัญ**
1. `const buffer = await file.arrayBuffer()` แล้ว **คำนวณ checksum ก่อนส่ง pdf.js**:
   `hex(await crypto.subtle.digest("SHA-256", buffer))` — เพราะ `getDocument({data})` ของ pdf.js
   โอนสิทธิ์ buffer ไป (transfer) ถ้าคำนวณทีหลัง buffer จะว่าง · เขียน helper `sha256Hex(buffer)` ในไฟล์เดียวกัน
2. โหลด pdf เหมือนเดิม
3. รีเซ็ตให้**ครบ**: `scales, measurements, gridLines, dimensions, references, past, future, thumbs,
   pendingRoom, pendingDimension, pendingRefStart, selectedId, documentId` และ `view` กลับ `{scale:1,x:0,y:0}`
   — **นี่คือการแก้บั๊กเดิม** ที่ `gridLines`/`dimensions` ไม่ถูกล้างข้ามไฟล์ (handoff บันทึกไว้)
   ล้าง `lastSavedRef.current = {}`
4. `hydratingRef.current = true` → `registerDrawing({ projectId, checksum, mimeType: "application/pdf",
   byteSize: file.size, pageCount: loaded.numPages })` → ไม่ ok: `setSaveStatus({kind:"failed", message})`
   แล้ว **ยังใช้งานต่อได้แบบไม่เซฟ** (ห้ามพัง) → ok: `setDocumentId`
5. `loadDrawing({documentId})` → ยกขึ้นจอ: `scales[page] = { metresPerPoint, ratio: metresPerPoint * POINTS_PER_METRE }`
   (`POINTS_PER_METRE` จาก drawing-scale.ts) · `references[page] = {method, reference}` เฉพาะที่ reference ไม่ null ·
   `gridLines` = รวมทุกหน้า · `dimensions` = รวมทุกหน้า · ตั้ง `lastSavedRef` ของทุกหน้าที่โหลดมา
   (ลายเซ็นตามข้อ 5.3) · ถ้ามี view: `setPage(clamp(view.pageNumber, 1, numPages))` และ `setView(view)` ·
   จบด้วย `hydratingRef.current = false` (ใน `finally`)
6. ยกของขึ้นจอ **ไม่เข้า `commitWork`** เพราะไม่ใช่การกระทำของผู้ใช้ ประวัติย้อนกลับต้องเริ่มว่าง

**ฟังก์ชันเซฟหน้า**
```ts
async function persistPage(pageNumber: number, scale: PageScale, ref: { method; reference }) {
  if (!documentId) return;
  const grid = gridLines.filter((l) => l.page === pageNumber);
  const items = dimensions.filter((d) => d.page === pageNumber);
  setSaveStatus({ kind: "saving" });
  const result = await saveDrawingCalibration({ documentId, pageNumber, metresPerPoint: scale.metresPerPoint,
    method: ref.method, reference: ref.reference, grid, dimensions: items });
  if (result.ok) { lastSavedRef.current[pageNumber] = signature(...); setSaveStatus({ kind: "saved", at: new Date() }); }
  else setSaveStatus({ kind: "failed", message: result.message });
}
```
ระวัง closure: `gridLines`/`dimensions` ใน `persistPage` ต้องเป็นค่าล่าสุด — เรียกจาก effect (ข้อ 5.3)
เป็นหลัก ส่วนจุดเรียกตรงให้ส่ง slice เข้ามาเป็นอาร์กิวเมนต์แทนการอ่านจาก closure

**จุดเซฟที่เป็นการกระทำของคน**
- `applyCalibration` (:830): หลัง `setScales` → `setReferences(page → { method: "two_point",
  reference: { version:1, a: calibrationPoints[0], b: calibrationPoints[1], realDistance: Number(realDistance), unit } })`
  → `persistPage(page, result.scale, thatRef)` ส่ง grid/dimensions ปัจจุบันของหน้า
- `saveDimension(alsoCalibrate)` (:990): เมื่อ `alsoCalibrate` → reference
  `{ version:1, a: dimension.a, b: dimension.b, realDistance: dimension.valueM, unit: "m" }` method
  `"stated_dimension"` → persist โดยส่ง `dimensions` ที่**รวมตัวใหม่แล้ว** · เมื่อไม่ calibrate:
  ไม่ต้องเรียกตรง ปล่อยให้ effect ข้อ 5.3 จัดการ (มันจะเห็น dimensions เปลี่ยน)

**5.3 effect เซฟตามการเปลี่ยนของกริดและระยะจริง** (ครอบ undo/redo/ลบ ด้วย)
```ts
useEffect(() => {
  if (hydratingRef.current || !documentId) return;
  const timer = setTimeout(() => {
    for (const p of Object.keys(scales).map(Number)) {
      const ref = references[p]; const scale = scales[p];
      if (!ref || !scale) continue;
      const sig = signature(scale, gridLines.filter(l => l.page === p), dimensions.filter(d => d.page === p));
      if (lastSavedRef.current[p] === sig) continue;
      void persistPage(p, scale, ref);
    }
  }, 800);
  return () => clearTimeout(timer);
}, [gridLines, dimensions, scales, references, documentId]);
```
`signature = JSON.stringify({ m: scale.metresPerPoint, g: grid, d: dims })` · หน้าที่ยังไม่มีสเกล
ไม่เซฟ (แผนแม่ 2.2 — กริดที่ร่างก่อนยืนยันสเกลอยู่ในเบราว์เซอร์จนถึงตอนนั้น)

**5.4 effect เซฟจุดที่ค้าง**
```ts
useEffect(() => {
  if (hydratingRef.current || !documentId) return;
  const timer = setTimeout(() => {
    void saveDrawingView({ documentId, pageNumber: page, view: { version: 1, ...view } });
  }, 1500);
  return () => clearTimeout(timer);
}, [documentId, page, view]);
```
เงียบ ไม่แตะ `saveStatus` ไม่แสดงอะไร — ล้มเหลวก็ไม่เป็นไร ตามคอมเมนต์ตาราง

**5.5 แถบสถานะ** ใน `<span className="mk__status-right">` (:1621) เพิ่มหนึ่ง span ท้ายสุด
`className="mk__status-save"` ข้อความ: `saving` → "กำลังบันทึก" · `saved` → "บันทึกแล้ว HH:MM"
(เวลาไทย 24 ชม.) · `failed` → "บันทึกไม่สำเร็จ — {message}" · `idle` → ไม่แสดง · ไม่มีไฟล์เปิด → ไม่แสดง ·
สไตล์ใน `globals.css` ใกล้ `.mk__status` ใช้โทเคนสีที่มีอยู่เท่านั้น (ADR 0021) `failed` ใช้สีเตือนที่แถบอื่นใช้อยู่แล้ว
ห้ามค่าสีฝัง

**5.6 คอมเมนต์ที่ต้องแก้** `newId` (:243) เขียนว่า "ยังไม่ได้ลงฐานข้อมูล จึงพอแค่ไม่ชนกันภายในหน้าเดียว" —
ตอนนี้ id ของ grid line กับ dimension ลงฐานผ่าน jsonb แล้ว แต่ยังใช้แค่จับคู่ภายในเอกสาร ไม่ใช่ PK
แก้คอมเมนต์ให้ตรง ไม่ต้องเปลี่ยนรูป id

## ขั้น 6 — ตรวจของจริงใน Edge

ผ่าน `chrome-devtools` MCP เท่านั้น (AGENTS.md) · `take_snapshot` ก่อนทุก click/fill · เจอหน้า login
ให้**หยุดแล้วรายงาน** ห้ามกรอก

1. dev server: ตรวจว่ามี `pnpm dev` รันอยู่แล้วหรือไม่ (`netstat` หา 3000) ถ้าไม่มีให้รันเป็น background
2. เปิด `/apps/estimeter/projects/<projectId>/markup` — projectId เอาจากหน้ารายการโครงการ
3. เปิดไฟล์ `km/kusumal_hospital/*.pdf` ผ่าน `upload_file` บน `<input type="file">` → ไปหน้า 7
4. ร่างแนวเสาสองเส้น (แนวตั้งหนึ่ง แนวนอนหนึ่ง) → เครื่องมือระยะจริง ลากช่วง 5.00 ม. ที่แบบเขียน →
   พิมพ์ 5.00 → กดตั้งสเกลจากค่านี้ → แถบสถานะต้องขึ้น 1:125 (ค่าที่รอบก่อนพิสูจน์แล้ว) และ "บันทึกแล้ว"
5. ซูมเข้า เลื่อนไปมุมใดมุมหนึ่ง รอ 2 วินาที
6. **ปิดแท็บ เปิดใหม่ เลือกไฟล์เดิม** → ต้องเห็น: หน้า 7 เปิดอยู่ · ซูมและตำแหน่งเดิม · แนวเสาสองเส้น ·
   เส้นระยะจริง 5.00 · สเกล 1:125 · ประวัติย้อนกลับว่าง (Ctrl+Z ไม่ทำอะไร)
7. ลากช่วงถัดไปที่แบบเขียน 5.00 ด้วยเครื่องมือวัดความยาว → ต้องได้ 5.00 (**เทียบเลขที่แบบเขียนเสมอ**)
8. ภาพหน้าจอทุกขั้น เก็บใน scratchpad · คอนโซลต้องไม่มี error · ตรวจแถวในฐานด้วยสคริปต์
   (มีต้นแบบที่ `scratchpad/inspect-0015.mjs` ต้อง copy เข้ารีโปชั่วคราวเพื่อให้เจอ `pg` แล้วลบ)
9. responsive: หน้าวาดตรวจที่ 820×1180 กับ 1440 พอ (เจ้าของงานเคาะแท็บเล็ตขึ้นไป) · ไม่มีเลื่อนแนวนอน ·
   **ล้าง emulation ก่อนจบ** (memory: เจ้าของงานดู Edge ตัวเดียวกัน)

## ลำดับ commit

1. ขั้น 1 (lib + เทสต์)
2. ขั้น 2 (ย้าย requireEditAccess)
3. ขั้น 3 (repository + integration test — รันจริงให้ผ่านก่อน commit)
4. ขั้น 4 (actions)
5. ขั้น 5 (หน้าจอ) — commit หลังขั้น 6 ผ่านครบ พร้อมแนบผลตรวจในข้อความ

## รายงานกลับ

บอกตรง ๆ ว่าขั้นไหนผ่าน ขั้นไหนติด ติดตรงไหน · เลข commit · จำนวนเทสต์ก่อน/หลัง · path ภาพหน้าจอ ·
ค่าที่วัดได้เทียบกับที่แบบเขียน · และ**ทางแยกที่ไม่ได้ตัดสินไว้ในสเปก** ถ้ามี
