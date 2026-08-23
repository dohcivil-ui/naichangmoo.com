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

**ค่างานที่ตกระหว่างขั้นของตาราง Factor F ให้เทียบอัตราส่วน** ตามหมายเหตุข้อ 1 ที่พิมพ์ใต้ทุกตาราง
ห้ามหยิบค่าของขั้นที่ต่ำกว่ามาใช้ ซึ่งง่ายกว่าและให้ตัวเลขที่ดูใกล้เคียงพอจนไม่มีใครทัก แต่ให้ราคากลางสูงกว่าที่หลักเกณฑ์กำหนด
ค่าที่เทียบได้ต้องปัดเป็นทศนิยมสี่ตำแหน่งก่อนนำไปคูณ เพราะ ปร.5 พิมพ์ Factor F ไว้สี่ตำแหน่งและคูณด้วยเลขที่พิมพ์
การเก็บทศนิยมมากกว่าที่แผ่นแสดงจะทำให้แผ่นตรวจเลขของตัวเองไม่ผ่าน และ Factor F หนึ่งค่าใช้กับทั้งหมวดงาน
โดยเลือกจากค่างานต้นทุนรวมของหมวด ไม่ใช่เลือกรายบรรทัด

ผลลัพธ์ที่แสดงต่อผู้ใช้ต้องบอกได้ว่าค่านั้นมาจากขั้นที่พิมพ์ไว้ หรือมาจากการเทียบอัตราส่วน พร้อมสองขั้นที่คร่อมอยู่
เพราะวันที่ถูกตรวจสอบ ผู้ใช้ต้องชี้ที่มาของตัวคูณได้ทันที

งานเงินกู้หรือจากแหล่งอื่นที่ไม่ต้องชำระภาษีมูลค่าเพิ่ม ให้ใช้คอลัมน์ "รวมในรูป Factor" ตามหมายเหตุข้อ 2
ไม่ใช่คอลัมน์ที่รวม VAT แล้ว

ทุกชุดข้อมูลอ้างอิงต้องพกที่มาไปกับตัวเลข: หน่วยงานผู้ออก เลขที่หนังสือ วันที่ หลักเกณฑ์ที่อาศัยอำนาจ
และ checksum ของไฟล์ต้นทาง ค่าที่ไม่มีที่มาครบห้ามเข้าการคำนวณ และชุดข้อมูลที่ยังไม่มีผู้มีคุณวุฒิรับรอง
ต้องประกาศสถานะนั้นออกมาให้ผู้เรียกปฏิเสธได้

## Hermes pilot

Hermes only handles `takeoff_evidence_review` jobs. It produces a non-authoritative review summary. Any mutation or external effect needs an explicit approval gate in the application; it is prohibited in the pilot worker.
