# ADR 0005: Enterprise quotation intake before billing

**Status:** Accepted

## Context

องค์กรและหน่วยงานต้องมีช่องทางขอใบเสนอราคา แต่ผลิตภัณฑ์ยังไม่กำหนด package, pricing, tax or sales approval process. การสร้าง invoice/checkout อัตโนมัติในตอนนี้เสี่ยงต่อข้อมูลธุรกิจและข้อผูกพันที่ยังไม่อนุมัติ.

## Decision

สร้าง enterprise quotation intake model และ Landing menu สำหรับรับ organization requirement, intended apps, contact channel, headcount/usage context, optional procurement note และ consent timestamp. Record มี status workflow `submitted → triaged → contacted → proposal_prepared → closed`; ไม่มีการสร้าง invoice, payment intent หรือการส่งข้อความออกโดยอัตโนมัติ.

## Alternatives considered

| Alternative | Why not selected now |
|---|---|
| Stripe checkout ทันที | ไม่มี approved package/pricing/tax policy และไม่ตอบ B2B procurement flow |
| กล่อง email สาธารณะอย่างเดียว | ไม่มี audit, ownership, status หรือ integration path |
| สร้าง CRM เต็มรูปแบบ | เกิน scope ของ Initial Project |

## Consequences

ต้องมี validation/consent/retention policy, internal review route และ role policy. Stripe billing tables จะรองรับอนาคตแต่ไม่มี live payment action จนกว่าจะมี ADR ใหม่.
