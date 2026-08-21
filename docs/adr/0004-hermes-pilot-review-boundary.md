# ADR 0004: Hermes pilot review boundary

**Status:** Accepted

## Context

Hermes Agent ต้องทำงาน 24/7 บน Hostinger VPS แต่ agent ที่มี tool access และ persistent memory เป็น security boundary ที่ไม่ควรได้รับสิทธิ์ production โดยตรง. Pilot ต้องเริ่มด้วยงานที่มีขอบเขตและตรวจสอบได้.

## Decision

run Hermes ใน isolated container บน production VPS ผ่าน non-root service account. Hermes รับเฉพาะ typed `takeoff_evidence_review` jobs จาก queue และคืน structured review findings. Hermes ไม่มี direct `DATABASE_URL`, R2 admin credential, Stripe secret, SSH key หรือ capability to mutate project, price, document, infrastructure or external communication.

ทุก job มี immutable input snapshot/reference, correlation ID, actor/workspace context, maximum runtime, retry policy, audit record, approval status และ kill switch. ผลลัพธ์เป็น advisory only; UI ห้าม auto-apply.

## Alternatives considered

| Alternative | Why not selected now |
|---|---|
| ให้ Hermes เขียนข้อมูล project โดยตรง | audit/rollback/authorization ไม่เพียงพอใน pilot |
| เปิด agent แบบ open-ended พร้อม browser/terminal | blast radius สูงและไม่สอดคล้องกับ use case แรก |
| เลื่อนสร้าง agent boundary ทั้งหมด | จะทำให้ source ต้อง redesign ใหม่เมื่อเปิด 24/7 agent |

## Consequences

ต้องออกแบบ queue, dead-letter handling, rate limits, tool allowlist, observability และ operator kill switch ตั้งแต่ schema รอบแรก. การขยาย capability ต้องใช้ ADR ใหม่, threat review และ explicit user approval.
