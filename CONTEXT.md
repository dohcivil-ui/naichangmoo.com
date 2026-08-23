# นายช่างหมู — Context

คำศัพท์ในเอกสารนี้เป็นภาษากลางของ product, design, schema และ source code สำหรับ platform นายช่างหมู คำจำกัดความจะอธิบาย domain ไม่ผูกกับ implementation ในภาษาใดภาษาหนึ่ง

## Platform

**Platform Membership**:
สถานะสมาชิกที่เกิดทันทีหลังผู้ใช้ลงทะเบียนกับนายช่างหมู เป็นตัวตนกลางที่ใช้ตรวจสิทธิ์ของทุก app.
_Avoid_: บัญชีแอป, trial account

**App Entitlement**:
สิทธิ์ของสมาชิกต่อ app หนึ่ง app ซึ่งระบุระดับการใช้และข้อจำกัดที่มีผลจริงใน server-side policy.
_Avoid_: package flag, UI lock

**Organization**:
หน่วยงานหรือบริษัทที่มีสมาชิกและโครงการร่วมกันภายใต้ขอบเขตข้อมูลและสิทธิ์เดียวกัน.
_Avoid_: tenant เมื่อสื่อสารกับผู้ใช้งาน

**Enterprise Quotation Request**:
คำขอให้ทีมงานจัดทำข้อเสนอสำหรับองค์กรหรือหน่วยงาน เป็น intake record ที่เก็บ requirement และสถานะติดตาม ไม่ใช่ใบเสนอราคา ภาษี หรือการชำระเงิน.
_Avoid_: invoice, quote ที่อนุมัติแล้ว

## ESTIMETR

**Workspace**:
พื้นที่ทำงานหนึ่งงานที่จัด input, validation, calculation และ evidence/result ตามลำดับ ไม่ใช่ dashboard รวมงานที่ไม่มี action ชัดเจน.
_Avoid_: dashboard, control center

**Project**:
หน่วยงานประมาณราคางานอาคารหนึ่งรายการที่มีบริบท แบบ ปริมาณ ราคา revision และเอกสารเป็นของตัวเอง.
_Avoid_: job, case

**Trial**:
สิทธิ์ชั่วคราวสำหรับสมาชิก platform ที่สมัครแล้ว ให้ใช้ ESTIMETR ได้ 5 วันและได้ไม่เกิน 1 โครงการ โดยปิด export และ print.
_Avoid_: guest access, anonymous demo

**Read-only Retention**:
สถานะหลัง trial หมดอายุที่เก็บข้อมูลเดิมให้เจ้าของดูได้ แต่ปิด create, edit, AI analysis, export และ print ทั้งหมด.
_Avoid_: deleted trial, frozen database

**Evidence**:
ที่มาที่ตรวจสอบย้อนกลับได้ของปริมาณหรือข้อสรุป เช่น drawing reference, geometry, page, source record หรือ review note.
_Avoid_: AI answer, claim

**Price Set**:
ชุดราคาที่มีแหล่งอ้างอิง ช่วงเวลา จังหวัด และสถานะอนุมัติชัดเจน เพื่อผูกกับ revision ของ project.
_Avoid_: current price, live price โดยไม่มี version

**Guided AI Assistant**:
ผู้ช่วยใน Workspace ที่สอนการใช้เครื่องมือ อธิบายข้อมูลหรือ prerequisite ที่ขาด และถามคำถามทบทวนตามขั้นตอนปัจจุบัน โดยผู้ใช้เลือกข้ามคำแนะนำหรือขอความช่วยเหลือได้เสมอ.
_Avoid_: autonomous estimator, AI ที่ทำแทนผู้ใช้ทั้งหมด

**Document Readiness**:
สถานะที่บอกว่าข้อมูลและการทบทวนของสายเอกสารหนึ่งครบตาม quality gate ที่กำหนดแล้ว จึงสามารถเสนอให้สร้างเอกสารหรือ output ได้; ไม่ใช่คำยืนยันว่าข้อมูลถูกต้องโดยไม่มีการอนุมัติ.
_Avoid_: auto-approved document, PDF พร้อมส่งโดยอัตโนมัติ

## Hermes

**Hermes Review Job**:
งาน typed job ที่ส่งหลักฐาน AI Takeoff ให้ Hermes สรุปประเด็นที่ต้องทบทวน โดยไม่มีสิทธิ์เปลี่ยนข้อมูลธุรกิจหรือสื่อสารภายนอก.
_Avoid_: autonomous project editor, agent task แบบไร้ขอบเขต

**Approval Gate**:
จุดยืนยันโดยผู้มีสิทธิ์ก่อนผลของ agent สามารถเปลี่ยนข้อมูล ปล่อยเอกสาร ส่งข้อความ หรือก่อผลภายนอก.
_Avoid_: auto-apply
