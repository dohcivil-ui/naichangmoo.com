# Harness Audit — 2026-08-23

ตรวจแบบ read-only บน branch `feature/estimeter-trial-activation` ขณะ HEAD = `fae066b`
คำถามที่ตั้งไว้: กระบวนการที่ `AGENTS.md` ประกาศไว้ ถูกบังคับจริงแค่ไหน และงานหลุดทางได้ตรงไหน

เอกสารนี้เป็นบันทึกการตรวจ ไม่ใช่แผนแก้ งานที่ต้องแก้ถูกยกเป็น roadmap item ใน `docs/roadmap/roadmap.v0.17.0.json`
(IP-053 ถึง IP-058) ข้อที่ยังไม่มีเจ้าของถูกทิ้งไว้ในเอกสารนี้เพื่อให้หยิบทีหลังได้

## สภาพรวม

Gate ที่รันได้จริงในเครื่องพัฒนาผ่านทั้งหมด:

```
pnpm typecheck                      → ผ่าน
pnpm lint                           → ผ่าน (0 warnings)
pnpm test                           → 16 files passed | 3 skipped ; 79 tests passed | 21 skipped
node scripts/check-roadmap.mjs      → valid
node scripts/security-check.mjs     → passed
git diff --check                    → ไม่มี output
```

ไม่ได้รัน `pnpm build` (แตะ network/secrets) และไม่แตะ DB/migration

**คุณภาพโค้ด ESTIMETR อยู่ในเกณฑ์ดี** — write path เช็ค entitlement เองทุกจุด ปริมาณบวกด้วย scaled integer
ไม่ใช่ float หน่วยเป็นชุดปิด ทุก query ผูก organization ทุก mutation เขียน audit และค้นทั้ง `src/`
ไม่พบราคา Factor F หรือค่าแรงที่ hard-code แม้แต่ตัวเดียว

ปัญหาที่เจอส่วนใหญ่จึงไม่ใช่ "โค้ดผิดวันนี้" แต่คือ **ไม่มีอะไรบังคับให้มันยังถูกอยู่ใน slice หน้า**

## ข้อค้นพบเรียงตามความรุนแรง

### S1 — pre-commit hook ไม่ได้เปิดใช้งาน กฎ governance ทั้งชุดจึงไม่มีอะไรบังคับ → IP-055

- `git config core.hooksPath` ไม่มีค่า (exit 1) — `scripts/setup-git-hooks.mjs:3` (`pnpm hooks:setup`) ยังไม่เคยรัน
- `hooks/pre-commit:4-9` มี check-roadmap + lint + test + typecheck ครบ แต่ไม่ถูกเรียก
- `docs/roadmap/README.md` เขียนว่า "The pre-commit hook verifies the current pointer" ซึ่งไม่จริงในเครื่องนี้
- `.github/workflows/quality.yml:6-9` push trigger ครอบเฉพาะ `initial-project/nextjs-foundation`
  และ `initial-project/nextjs-scaffold`

ผล: commit บน feature branch ไม่มีทั้ง hook และ CI จนกว่าจะเปิด PR

### S2 — CI ไม่เคยรันชุดทดสอบที่พิสูจน์เรื่องสำคัญที่สุด (21 tests ถูก skip) → IP-053

- `describe.skipIf(!enabled)` โดย `enabled = process.env.ESTIMETR_DB_TESTS === "1"` ที่
  `src/server/estimeter-access.integration.test.ts:26,28`,
  `src/server/estimeter/project-repository.integration.test.ts:27,29`,
  `src/server/estimeter/takeoff-repository.integration.test.ts:27,32`
- `.github/workflows/quality.yml:38-41` ไม่ตั้ง `ESTIMETR_DB_TESTS` ไม่มี PostgreSQL service และ `env -u DATABASE_URL`

สิ่งที่ถูก skip คือสิ่งที่ handoff อ้างเป็น verification พอดี — `docs/handoff/index.json` v0.16.0 เขียนว่า
"vitest 19 files / 100 tests passed with the opt-in PostgreSQL suites enabled" และ v0.15.0 เขียนว่า
"the item lock test was shown to fail when the row lock is removed"

แปลว่าเพดาน 1 โครงการภายใต้ row lock, entitlement แถวเดียวตอนกดพร้อมกัน, item lock และนาฬิกาที่เริ่มตอน
activation ไม่มีอันไหนถูกตรวจโดยเครื่องใน CI เลย CI เขียวแปลว่า 79/100 ผ่าน ไม่ใช่ 100/100

### S3 — `capabilities.read` ประกาศเป็นนโยบายฝั่ง server แต่ไม่มีจุดไหนบังคับ → IP-054

- `src/lib/entitlement.ts:45` — `suspended: { read: false, ... }`
- `src/server/estimeter-access.ts:252-255` — `apps.enabled = false` override state เป็น `"suspended"`
  พร้อมคอมเมนต์ว่าเป็น platform-level kill switch
- grep `capabilities.read` ทั้ง `src/` เจอเฉพาะในไฟล์ test (`estimeter-access.integration.test.ts:179,200`)
- `src/app/apps/estimeter/page.tsx:18` ยังเรียก `listProjects(...)`,
  `src/app/apps/estimeter/projects/[projectId]/page.tsx:23` ยังเรียก `getProject(...)`,
  หน้า takeoff `:52-59` ยังอ่าน run/item/evidence

ผล: ปิดสวิตช์แล้วสมาชิกยังเปิดดูโครงการ ปริมาณ และหลักฐานได้ทั้งหมด กันได้แค่การเขียน
(`estimeter-takeoff.ts:58` เช็ค `capabilities.edit`) ขัดกับ `docs/rules/engineering.md` ที่เขียนว่า
entitlement ต้องถูกตรวจฝั่ง server ในทุก protected action

### S4 — roadmap pointer แตกจากไฟล์เวอร์ชันได้โดยไม่มีอะไรเห็น → IP-056

- `fae066b` แก้ `docs/roadmap/roadmap.json` 3 บรรทัด (`updatedAt`, `status`, verification line)
  ให้ต่างจาก `roadmap.v0.16.0.json` โดยไม่สร้างเวอร์ชันใหม่ ผิด `docs/roadmap/README.md` ที่ห้ามแก้ไฟล์เวอร์ชันที่ commit แล้ว
- `scripts/check-roadmap.mjs:11` ตรวจแค่ `version`, `updatedAt` และ `items` เป็น array
  ไม่เทียบ pointer กับไฟล์เวอร์ชัน ไม่เทียบกับ `package.json` version ไม่ตรวจว่ามี handoff
- tag `v0.16.0-estimeter-trial-activation` ชี้ `aebdbbb` แต่ pointer อ้าง `ea0974e` ในช่อง verification
  tag จึงไม่ครอบสิ่งที่ roadmap อ้าง

### S5 — 2 commit บน branch นี้ไม่มีทั้ง roadmap และ handoff → IP-056

- `ea0974e fix(ci): enable pnpm before setup-node cache lookup` ไม่แตะ roadmap.json หรือ `docs/handoff/`
- `9936729 feat: add public intake abuse controls...` ไม่แตะเช่นกัน ทั้งที่คอมมิตนี้เพิ่ม migration 0001

ผิด `AGENTS.md` ข้อ 4 และข้อ 7 และ `docs/rules/engineering.md` ที่เขียนว่า commit ที่ไม่มี handoff ถือว่าไม่สมบูรณ์
ส่วนที่ทำถูกครบ: tag ทุก milestone ชี้คอมมิตถูกต้อง (`v0.13.0→a6f6f31`, `v0.14.0→3d83564`,
`v0.15.0→45dc8ec`, `v0.16.0→aebdbbb`)

### S6 — `waste_percent` ไม่มี CHECK คู่กับ `waste_source_note` → IP-057

`drizzle/0002_silly_joseph.sql`:

```sql
ALTER TABLE "takeoff_items" ADD COLUMN "waste_percent" numeric(9, 6) DEFAULT '0' NOT NULL;
ALTER TABLE "takeoff_items" ADD COLUMN "waste_source_note" text;
```

roadmap v0.17.0 scope เขียนเองว่า "record a waste percentage that refuses to apply without a stated source"
แต่ migration ไม่มี `CHECK (waste_percent = 0 OR waste_source_note IS NOT NULL)` กฎจึงบังคับได้เฉพาะ
application layer — write path ที่สองหรือการแก้มือใน psql หลุดได้ทันที

### S7 — เลือก organization แบบไม่กำหนดลำดับ → IP-058

- `src/server/estimeter-access.ts:81-97` — `readEstimeterEntitlement` join `organizationMembers`
  ด้วย `userId` แล้ว `.limit(1)` ไม่มี `ORDER BY`
- `src/server/estimeter-access.ts:115-122` — `readMembershipOrganization` `.limit(1)` ไม่มี `ORDER BY`
- `src/db/schema.ts:88` — `organization_members` unique แค่ `(organizationId, userId)` จึงอนุญาตให้
  user หนึ่งคนอยู่หลายองค์กรได้ตั้งแต่วันนี้

วันนี้ยังไม่ระเบิดเพราะทุกคนมี personal org เดียว (`personalOrgId()` ที่ `:53`) วันที่มี organization จริง
ซึ่งคือทั้งจุดขาย enterprise องค์กรไหนเป็นเจ้าของโครงการและ entitlement แถวไหนคุมสิทธิ์
จะขึ้นกับว่า Postgres คืนแถวไหนมาก่อน

## ข้อค้นพบที่ยังไม่มีเจ้าของ (หยิบเมื่อถึง slice ที่เกี่ยวข้อง)

### S8 — `addManualItem` ไม่ล็อกแถว run

`src/server/estimeter/takeoff-repository.ts:288-291` อ่าน `run.state` โดยไม่มี `.for("update")` แล้ว insert ที่ `:294`
ส่วน `closeManualRun:470-482` ล็อกเฉพาะแถวที่มีอยู่แล้ว ซึ่งไม่กัน INSERT ใหม่
(เทียบกับ `startManualRun:211-216` ที่ล็อกแถว project ก่อน — pattern ที่ถูกอยู่แล้วในไฟล์เดียวกัน)

ลำดับที่พังภายใต้ READ COMMITTED: A อ่าน state = running → B ปิด run เขียน `outputHash` แล้ว commit →
A insert สำเร็จ ได้รายการ `proposed` ค้างใน run ที่ปิดแล้วและอยู่นอกลายนิ้วมือ
ความเสียหายจำกัดเพราะ `confirmManualItem:374` ปฏิเสธด้วย `run_not_open` แต่ขัดกับคอมเมนต์ที่ `:454-458`
ที่บอกว่า hash คือสิ่งที่ขั้นถัดไปใช้เทียบ

### S9 — export/print ล็อกในนโยบายแต่ไม่มีด่านฝั่ง server

`src/lib/entitlement.ts:40,44` ล็อก `exportEnabled`/`printEnabled` สำหรับ trial และ expired_read_only
แต่ grep `capabilities.export` / `capabilities.print` เจอที่เดียวคือ
`src/components/estimeter/entitlement-status.tsx:45-46` ซึ่งเป็นแค่การแสดงผล
ยังไม่ใช่บั๊กเพราะยังไม่มีโค้ด export แต่ ADR 0003 กำหนดว่าล็อก export คือเงื่อนไขของ trial
วันที่ slice ออกเอกสารมาถึง จุดนี้จะพลาดโดยไม่มีอะไรเตือน

### S10 — `listEvidenceForItems` เป็นฟังก์ชันอ่านตัวเดียวที่ไม่รับ `organizationId`

`src/server/estimeter/takeoff-repository.ts:186-199` เทียบกับเพื่อนบ้านทุกตัว
(`getOpenManualRun:123`, `listManualRuns:150`, `listRunItems:167`) ที่รับ `organizationId` เป็นตัวแรก
วันนี้ปลอดภัยเพราะผู้เรียกเดียว (หน้า takeoff `:59`) ส่ง id ที่ scope มาแล้ว
แต่ปลอดภัยด้วย "ผู้เรียกทำถูก" ไม่ใช่ด้วย signature — ผู้เรียกคนที่สองคือจุดที่พลาด
คอมเมนต์ที่ `:60-64` เขียนเองว่าการข้าม join นี้เปิดข้อมูลข้ามองค์กร

### S11 — ขั้นราคาเป็น simulation ฝั่ง client ล้วน

`src/components/estimeter/estimation-workspace.tsx:61` `useState(false)` สำหรับ `priceSetApproved`,
`:96-102` `approvePriceSet()` / `completeCostReview()` เป็น state ใน browser ไม่เขียนอะไร
โค้ดระบุเองที่ `:167` ว่าเป็นการจำลอง และปิดล็อก export ปร.4/5/6 ไว้ที่ `:176`

อันนี้ซื่อสัตย์ ไม่ใช่บั๊ก และการที่ไม่มีตัวเลขราคาปลอมเลยคือจุดแข็ง
แต่ไม่มีกฎกันไม่ให้ gate แบบ `useState` นี้ถูกต่อเข้ากับเงินจริงใน slice ราคา

### S12 — หน่วยที่ไม่รู้จักตกลงเป็น count เงียบๆ

ทำถูกและควรถือเป็น baseline: `src/lib/takeoff-units.ts:18-27` ชุดหน่วยปิด 8 หน่วยพก `dimension`,
`src/lib/takeoff-summary.ts:22-30` รวมยอดแยกตาม unit ไม่ใช่ dimension (ตัน กับ กก. ห้ามรวมกัน),
`src/lib/takeoff-quantity.ts:9-11,42-59` บวกด้วย BigInt scale 1e-6 ตรงกับ `numeric(18,6)` และ `:62-69` ไม่ปัดเศษในขั้นปริมาณ

จุดที่ยังหลุด: `src/lib/takeoff-summary.ts:35` — `findUnit(unit)?.dimension ?? "count"`
ถ้าถอดหน่วยออกจาก `TAKEOFF_UNITS` แถวเก่าใน DB จะกลายเป็น dimension count เงียบๆ แทนที่จะ error
และ `src/db/schema.ts:171` เป็น `text` เปล่า ไม่มี constraint ฝั่ง DB ผูกกับชุดหน่วย

### S13 — test อ่าน `.env` จากดิสก์ ขัดกับ Safety rules ตรงตัว

`loadLocalEnv()` ที่ `src/server/estimeter-access.integration.test.ts:8-20` (ซ้ำใน
`project-repository.integration.test.ts:8-20` และ `takeoff-repository.integration.test.ts:8-20`)
อ่านไฟล์ env จาก working directory เข้า `process.env` ขณะที่ `AGENTS.md` เขียนว่าห้ามอ่านไฟล์ env เลย

ในทางปฏิบัติมันคือ loader สำหรับ `DATABASE_URL` ตอนรัน DB test บนเครื่องตัวเอง และ CI ก็ตัด `DATABASE_URL` อยู่แล้ว
จึงไม่ใช่ช่องรั่ว แต่กฎกับโค้ดขัดกันอยู่ ต้องเลือกอย่างใดอย่างหนึ่ง: เขียนข้อยกเว้นให้ชัด
หรือกฎข้อนี้จะกลายเป็นกฎที่ทุกคนรู้ว่าไม่ต้องทำตาม

### S14 — roadmap item เป็น done ได้ทั้งที่โค้ดยังไม่ commit

`IP-045` มี `"status": "done"` ขณะที่ `src/lib/takeoff-measurement.ts` ยัง untracked
และ roadmap เองยังเขียน `"status": "implementation_in_progress"` — ไม่มีอะไรตรวจสอบว่า item ที่ done
มีโค้ดอยู่ใน commit จริง

## km/ — สิ่งที่ใช้อ้างอิงได้ และสิ่งที่อ้างไม่ได้

`km/` มี 53 ไฟล์ ~271 MB ถูกใส่ `.gitignore` แล้วด้วยเหตุผลลิขสิทธิ์และขนาด
(ตำราและเอกสารอบรมในนั้นเป็นของผู้อื่น แจกซ้ำไม่ได้แม้ repo เป็น private)

| ค่าที่โค้ดจะต้องใช้ | ต้นทางที่ผูกได้ | สถานะ |
|---|---|---|
| Factor F งานอาคาร | `ตาราง Factor F อาคาร ใหม่.pdf` **คู่กับ** `ว499` | ตารางบอกค่า ว499 บอกอัตราดอกเบี้ยและวันที่ ต้องอ้างคู่กันเสมอ |
| อัตราค่าแรงถอดแบบ | `กรมบัญชีกลาง ว809 ลว.14 พ.ย. 68` | มีเลข ว. และวันที่ครบ อ้างได้จริง |
| ค่าเผื่อวัสดุ | `หลักเกณฑ์การเผื่อฯ` + `เกณฑ์การเผื่อฯ` (PDF) | **ห้ามใช้ตัวเลขจาก `ฐานความรู้-ถอดปริมาณครบทุกหมวด.md`** |
| ราคาวัสดุ | ไม่ผูกกับ PDF ไฟล์เดียว | ต้องเป็น price set ที่มี source/จังหวัด/เดือน/revision |
| น้ำหนักเหล็กเสริม กก./ม. | `0.006165 × d²` derive ได้ (7850 kg/m³ × π/4 ÷ 1e6) | ใส่ในโค้ดได้พร้อมที่มาของการ derive แต่ควรทานกับ `Thailand_Steel_Table` |
| ฟอร์ม ปร.4/5/6 | ยังไม่มีต้นฉบับ | ดูย่อหน้าถัดไป |

**ฟอร์ม ปร.4/5/6 ทั้งสี่ไฟล์ใน `km/` เป็นสำเนาจากบุคคลที่สาม ไม่ใช่ต้นฉบับของหน่วยงาน**
(`4.แบบ ปร.4 ปร.5 ปร.6.pdf`, `แบบฟอร์ม-ปร.-4-5-6-1.xls`, `แบบฟอร์ม-ปร.-4-ปร.5-และ-ปร.61.xls`,
`ตย ปร1-6 ราชมงคล..xlsx`) ใช้ทำความเข้าใจ layout ได้ แต่ **ปิด IP-042 ด้วยไฟล์ชุดนี้ไม่ได้**

**`ฐานความรู้-ถอดปริมาณครบทุกหมวด.md`** (11.6 KB ไฟล์เดียวใน `km/` ที่เป็น text) เขียนหัวเรื่องเองว่า
ห้ามเดาค่าเอง แต่ตัวมันเองมีค่าเผื่อ +7%/+3%/+5%/+10% จำนวนอิฐต่อตารางเมตร และส่วนผสมปูน-ทราย-หิน
โดยไม่มีที่มากำกับรายบรรทัด ถ้าจะย้ายเข้า `docs/knowledge/` ต้องใส่ citation ให้ทุกค่าก่อน
ไม่งั้นจะกลายเป็นแหล่ง "ค่าที่ดูน่าเชื่อถือเพราะอยู่ใน repo"

## คำถามที่ยังไม่มีคำตอบ และต้องตอบก่อน slice ราคา

1. **ราคากลางยึดประกาศของหน่วยงานไหน** — `docs/architecture/estimeter-operating-policy.md`
   อ้างประกาศคณะกรรมการราคากลาง (กระทรวงพาณิชย์) แต่ roadmap `IP-042` เขียนว่าให้ตรวจ official DPT source
   (กรมโยธาธิการและผังเมือง) คนละหน่วยงาน ทั้ง DocumentBaseline registry และ Factor F แขวนอยู่บนคำตอบนี้
   และยังไม่มีใครเปิดฉบับจริงยืนยันสักฝั่ง
2. **`PROJECT.md` ข้อ 4 ยังขัดกับ ADR 0006** — PROJECT.md เขียนว่า trial เริ่มตั้งแต่ลงทะเบียน
   ADR 0006 กำหนดว่านาฬิกาเริ่มตอน explicit activation ขณะที่ source-of-truth order จัด PROJECT.md ไว้เหนือ ADR
   คนที่เดินตามลำดับที่ประกาศไว้จะสรุปผิด
3. **`docs/SOURCE_CONTINUATION.md` ชี้ไปที่ `todo.md`** ซึ่งไม่มีอยู่ใน repo
4. **`docs/handoff/index.json` มี entry ที่ไม่ใช่ semver** (`"version": "vscode-continuation"`)
   ขณะที่ entry อื่นและ console สมมติว่าเป็น semantic version
