# ADR 0003: Platform membership, app entitlement and ESTIMETR trial

**Status:** Accepted — the trial start point is superseded by ADR 0006

## Context

นายช่างหมูมีหลาย app แต่ต้องใช้ landing page และ identity กลางเดียว. ESTIMETR เป็น app ขายที่ต้องให้ทดลองใช้ 5 วัน/1 โครงการ โดยยังนับผู้สมัครเป็นสมาชิก platform ตั้งแต่วันแรก และต้องไม่ทำให้ข้อมูล trial สูญหายเมื่อสิทธิ์หมด.

## Decision

สร้าง platform member เมื่อ registration สำเร็จ. สร้าง personal organization เริ่มต้น และออก `app_entitlement` สำหรับ ESTIMETR ด้วย state `trial`, `starts_at = member.created_at`, `ends_at = starts_at + 5 days`, `project_limit = 1`, `export_enabled = false`, `print_enabled = false`. เมื่อหมดอายุ state เป็น `expired_read_only`; server-side policy lock create/edit/AI/export/print แต่อนุญาต read own retained data.

> **แก้ไขโดย ADR 0006:** `starts_at = member.created_at` ไม่ใช้แล้ว นาฬิกาทดลองใช้เริ่มนับเมื่อสมาชิกกดเริ่มทดลองใช้อย่างชัดแจ้ง เงื่อนไขอื่นในย่อหน้านี้ (5 วัน, 1 โครงการ, ปิด export และ print, read-only retention) ยังใช้ตามเดิม

RCOPT และ Traffic Sign ใช้ entitlement แบบ `member_free`. Land Acquisition V2 ใช้ `doh_staff_only` ใน app registry ใหม่ แต่ไม่ย้าย legacy authentication/data ใน initial release.

## Alternatives considered

| Alternative | Why not selected now |
|---|---|
| เริ่ม trial เมื่อสร้างโครงการแรก | ไม่สอดคล้องกับเป้าหมายสมาชิก platform ตั้งแต่ registration |
| ลบข้อมูลเมื่อ trial หมด | ทำลายความเชื่อมั่นและทำให้ผู้ใช้ตรวจงานเดิมไม่ได้ |
| client-only UI locks | ถูก bypass และไม่ป้องกัน API action |

## Consequences

ทุก mutation ต้อง call entitlement policy server-side. Billing integration ต้องเปลี่ยน entitlement ผ่าน verified webhook และ idempotency. UI แสดง reason ของ lock และ path ขอใบเสนอราคาสำหรับองค์กรได้ แต่ไม่ตัดสินสิทธิ์เอง.
