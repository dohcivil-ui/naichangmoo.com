# Project Memory — นายช่างหมู

## Product intent

นายช่างหมู — **CIVIL APPS ASSISTANT** เป็น platform ของเครื่องมือวิศวกรรมที่ทำให้ผู้ใช้ทำงานเป็นลำดับ เข้าใจผลลัพธ์ และตรวจสอบที่มาได้ ESTIMETR คือ app ขายตัวแรกสำหรับประมาณราคางานอาคาร ไม่ใช่ marketplace แอปหรือ dashboard ที่ยัด feature จำนวนมาก

## Confirmed portfolio

| App | Membership policy | Current work boundary |
|---|---|---|
| ESTIMETR / Estimate | paid app; trial 5 วัน/1 โครงการ/ห้าม export-print | initial implementation ใหม่ |
| RCOPT | member free | app registry + future revision only |
| Traffic Sign | member free | app registry + future revision only |
| Land Acquisition V2 | DOH staff only | do not alter legacy source/schema/data in this project |

## Core product rules

1. One landing page and one platform membership. Each app evaluates entitlement after authentication.
2. ESTIMETR uses a constrained engineering-tool workflow: **input → validation → calculation → evidence/result**.
3. AI proposes quantities/evidence; auditable source data supplies prices. AI must not manufacture prices.
4. A trial member is still a platform member from registration. The ESTIMETR trial runs 7 days and permits one project (ADR 0009 lengthened the original 5 days; amended here 2026-08-26 so the top-ranked document matches the ADR and the code).
5. When trial expires, retain data read-only. Lock all create/edit/AI/export/print actions.
6. Hermes pilot only reviews AI Takeoff evidence and summarizes review issues. It cannot write business data, release documents, send messages, spend money, or access production database credentials.
7. Every release must preserve a trace from project inputs to calculation, evidence, pricing and output decision.

## Delivery targets

Vercel is used for pilot deployment. Production portability targets Hostinger VPS with Next.js standalone deployment, PostgreSQL, Cloudflare R2, a Redis-backed worker queue and an isolated Hermes container. Do not rely on vendor-specific business logic.

## Explicit non-goals

Do not create or roadmap Smart Drawing/CAD, Traffic Vision, BOQ irrigation, Home Check, Civil Service exam preparation, or BOQ road/bridge/box-culvert tools. Do not refactor Land Acquisition V2 in this repository.

The material and labour price desk (PRICEMETR) is in scope as a platform app in the cost-and-estimating category. An earlier revision of this list forbade a "standalone central-price guide"; the owner amended that on 2026-08-26 (IP-165) because the price desk is not standalone — it feeds priced line items into the platform's estimating apps and lives under the same shell, registry and membership as every other app.

## Source-of-truth order

1. `CONTEXT.md` for vocabulary.
2. `PROJECT.md` for product intent and confirmed constraints.
3. `docs/roadmap/roadmap.json` for current executable plan.
4. `docs/adr/` for costly technical decisions.
5. `docs/handoff/` for latest handoff after each commit.

## Working agreement

Work on one trunk branch; a short-lived branch is merged and deleted in the same session. Before every commit, create a new roadmap version, update `roadmap.json` and write the changelog entry. After every commit, write a handoff note and close the version with `pnpm release`, which tags, pushes and publishes the GitHub Release together. Do not commit builds, dependencies, secrets, customer data, generated exports or provider credentials.
