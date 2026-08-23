# Mockup Verification — 2026-08-22

## Landing HTML

Landing ของ `naichangmoo.com` แสดง hero, ESTIMETR workflow rail, app cards ของ ESTIMETR/RCOPT/Traffic Sign/Land Acquisition V2, Hermes AI Agentic panel, enterprise quotation intake และ link ไป Roadmap/Handoff ได้บน desktop viewport.

## Interaction check

ปุ่ม trial/read-only policy preview ถูกแสดง. การตรวจ React props ยืนยันว่า client component hydrate และมี `onClick` handler; เมื่อเรียก handler แล้ว state เปลี่ยนเป็น read-only retention พร้อม lock create/edit/AI/export/print ถูกต้อง. Browser click automation ไม่ส่ง state transition ในครั้งแรกแม้ handler ถูก hydrate ซึ่งเป็นข้อจำกัดของ automation path ไม่ใช่ runtime error ของ source. ผลตรวจต่อไปต้องบันทึก responsive mobile และ Roadmap/Handoff refresh state.

## Exit condition

Landing mockup ต้องแสดง interaction ของ entitlement อย่างชัดเจน, navigation routes ต้องเปิดได้, และ Roadmap/Handoff console ต้องอ่าน version metadata ล่าสุดจาก source data ก่อนบันทึก milestone v0.3.0.

## Roadmap and handoff console

`/roadmap` แสดง Roadmap v0.3.0 พร้อม title, description, scope, item status และ runtime refresh time ได้จาก `docs/roadmap/roadmap.json`. แท็บ Handoff แสดง metadata ของ handoff ล่าสุด ได้แก่ version, title, description, changed scope, verification และ rollback จาก `docs/handoff/index.json` ได้ถูกต้อง.

## Visual-system update

Landing แสดง icon graphic ใหม่สำหรับ ESTIMETR, กำแพงกันดิน, Traffic Sign, Land Acquisition V2 และ Hermes ผ่าน allowlisted Next.js visual asset proxy ได้แล้ว. การแก้ proxy ทำให้ app cards ไม่อ้าง path storage ที่ไม่อยู่ใน Next.js dev server โดยตรง และคง migration path ผ่าน environment `STATIC_ASSET_ORIGIN` สำหรับ deployment ต่อไป.

Micro-interaction ของ card ถูกผูกกับ `pointermove`, hover/focus และ pointer leave ใน source. Browser coordinate automation รอบแรกยังไม่ได้อยู่ใน boundary ของ card จึงไม่พบ transform ใน computed style; ต้องทำ manual hover check รอบ final viewport เพื่อยืนยัน visual transition ก่อน release.

## Shared app shell

Routes `/apps/rcopt` และ `/apps/estimeter` แสดง `PlatformNav`, app context bar, entitlement label, workspace introduction และ `PlatformFooter` ในรูปแบบเดียวกัน. ความต่างของแต่ละหน้าอยู่ที่ชื่อ app, access label และ copy ของ workflow เท่านั้น โดย RCOPT แสดงชื่อผู้ใช้ว่า “กำแพงกันดิน” ตาม requirement ล่าสุด.
