# Engineering Rules

## Branch and commit discipline

Every new change starts on a dedicated branch. Before every commit, update roadmap version files and run the release/quality command that applies to the current scaffold. A commit without a handoff note is incomplete. Milestones require annotated semantic tags such as `v0.1.0-initial-governance`.

Every roadmap version, annotated tag, commit message and handoff must use an aligned **title**, **description**, **changed scope**, **verification** and **rollback** statement. The roadmap version file is immutable after commit; `roadmap.json` is the current pointer and the HTML console reads it at runtime.

## Data and migrations

Schema is source-controlled. A schema change must include a reviewed Drizzle migration, authorization impact, rollback/risk note and tests. Do not use `db push` as a substitute for a production migration process.

## Authentication and access

Entitlement must be checked by server-side policy on every protected action. Trial locks, read-only retention, app membership, organization boundaries and DOH-only access cannot rely on client-side visibility alone.

## Enterprise quotation intake

The quotation request form may collect organization requirements and a contact channel only after consent. It must not represent a binding offer, create invoices, capture payment data or automatically send external messages.

## Official circulars and reference tables

ค่าที่เข้าการคำนวณราคากลางต้องมาจากหนังสือเวียนกรมบัญชีกลาง **ฉบับล่าสุด** เสมอ ทั้งบัญชีค่าแรงงาน
สำหรับถอดแบบและตาราง Factor F ฉบับที่ถูกแทนแล้วห้ามเป็นแหล่งของค่าที่ระบบใช้
ณ 26 มิถุนายน 2569 ฉบับล่าสุดคือ **ว480** (บัญชีค่าแรงงาน) และ **ว481** (อัตราดอกเบี้ยและตาราง Factor F)
ซึ่งแทน ว809 และ ว499 ตามลำดับ

ทุกชุดข้อมูลอ้างอิงต้องพกที่มาไปกับตัวเลข: หน่วยงานผู้ออก เลขที่หนังสือ วันที่ หลักเกณฑ์ที่อาศัยอำนาจ
และ checksum ของไฟล์ต้นทาง ค่าที่ไม่มีที่มาครบห้ามเข้าการคำนวณ และชุดข้อมูลที่ยังไม่มีผู้มีคุณวุฒิรับรอง
ต้องประกาศสถานะนั้นออกมาให้ผู้เรียกปฏิเสธได้

## Hermes pilot

Hermes only handles `takeoff_evidence_review` jobs. It produces a non-authoritative review summary. Any mutation or external effect needs an explicit approval gate in the application; it is prohibited in the pilot worker.
