# ADR 0002: PostgreSQL, Drizzle migrations and R2 data boundary

**Status:** Accepted

## Context

Platform ต้องเก็บ organization, entitlement, project, revision, price provenance, audit trail, approval และ queue state ซึ่งมีความสัมพันธ์และต้องการ transaction ที่ตรวจสอบย้อนกลับได้. Drawing และ export artifact มีขนาดและ lifecycle ต่างจาก relational data.

## Decision

ใช้ PostgreSQL 16 เป็น system of record, Drizzle ORM พร้อม SQL migrations ที่ reviewable เป็น schema discipline, และ Cloudflare R2 เป็น authoritative object storage. Database เก็บ object metadata/key/checksum/access policy ไม่เก็บ bytes ของ drawing/export.

## Alternatives considered

| Alternative | Why not selected now |
|---|---|
| MySQL/TiDB schema เดิม | schema เดิมเป็น prototype และไม่ใช่ source of truth ของ Initial Project |
| document database | ทำให้ entitlement/revision/audit consistency และ relational reporting ซับซ้อนขึ้น |
| เก็บ file bytes ใน PostgreSQL | backup, query performance และ cost แย่ลงเมื่อ drawing/export โตขึ้น |

## Consequences

ทุก schema change ต้องมี Drizzle migration, authorization review, test และ rollback note. R2 uploads ต้องใช้ signed URL, content validation และ private buckets. Backups ของ PostgreSQL ต้องออกนอก VPS และทดสอบ restore.
