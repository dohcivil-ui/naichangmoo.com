# ESTIMETR Operating Policy: Accuracy, Provenance and Release Gates

## Purpose

ESTIMETR is a commercial estimating workbench, not an unconstrained spreadsheet or chatbot. It may assist an estimator, but every released number must remain traceable to a project revision, drawing evidence, price set, calculation rule and named approval. A user may return to an earlier stage to correct work; the system must not let the user move forward or release an output while the prerequisites of the next stage are incomplete.

> **Core rule:** AI can propose, explain and challenge. It cannot create an authoritative price, confirm a measurement, approve a document or release Excel/PDF by itself.

## Source-of-truth chain

| Layer | Immutable identifier | Required provenance | What may change it |
| --- | --- | --- | --- |
| Drawing revision | `drawing_documents.checksum` | File, page, revision context and calibration reference | Authorized upload/revision action |
| Take-off | `takeoff_runs.input_hash` / `output_hash` | Drawing revision, geometry/page evidence, formula, unit and reviewer state | Human confirmation or documented revision |
| Price observation | `price_observations.rawPayloadHash` | Provider, catalog code, province, effective month, `priceExcludingVat`, raw payload hash and fetch time | Ingestion process with audit event |
| Price set | `price_sets.payloadHash` | Fixed list of observations, province/month, VAT/transport treatment and approval status | Authorized price-set review |
| Estimate revision | revision number + `priceSetId` | Exact take-off set, price set and calculation-rule version | Authorized estimate revision action |
| Document/export | document baseline version + output checksum | Field mapping, validation result, approval request and generated artifact checksum | Server-side generation after approval only |

## Enforced stage contract

| Gate | User sees | Server-side prerequisite before unlock | What the assistant may do | Release blocker |
| --- | --- | --- | --- | --- |
| 0. Project setup | Choose **private** or **government** path; identify project, work type, province and price month. | Active entitlement and valid project context. | Explain path differences and identify missing project fields. | No project path/context. |
| 1. Drawing revision and scale | Attach drawing revision; set a known reference dimension and inspect calibration confidence. | File scan complete; drawing checksum; scale/evidence confirmed. | Explain scale setup and flag conflicting revisions. | No drawing revision or unconfirmed calibration. |
| 2. Take-off evidence | Measure/count/mark items with category, unit, formula and page/geometry evidence. | Every output-bound row is `confirmed` or deliberately excluded with a reason. | Propose items, explain the tool, list low-confidence evidence. | Proposed/rejected/unsupported item or missing formula/evidence. |
| 3. Price set | Select source, province and month; review material/labor separately and freeze a price-set revision. | Approved source observations; no unresolved VAT/transport treatment; price set is locked to estimate revision. | Explain a source gap; never invent a price or alter a price observation. | No approved price set or any required rate without provenance. |
| 4. BOQ review | Review quantity × approved unit cost, categories and exceptions. | Calculation version passes validation; an authorized reviewer approves the revision. | Explain an anomaly, dependency or missing review. | Arithmetic failure, incomplete review, stale source or altered upstream data. |
| 5a. Private release | Review direct cost, OH&P, profit, VAT and quotation/PDF readiness. | Private policy parameters completed and approved. | Teach the difference between cost and quotation. | Incomplete policy/approval. |
| 5b. Government release | Review document lineage, Factor F, rounding and official-form readiness. | Approved baseline version, field mapping, Factor F condition, rounding test pack and document approvals pass. | Explain which upstream field blocks the document. | Any baseline, mapping, pricing, Factor F, rounding or approval failure. |

## Government document compatibility policy

The 2569 government instrument located during research is a versioned building-construction rule set. Its reviewed building section positions itemized calculation / BOQ inputs upstream of a construction-cost summary and enumerates more sheet types than the current `ปร.4 → ปร.5 → ปร.6` mockup. Therefore, the production document engine must not hard-code a single timeless template. Instead it needs a `DocumentBaseline` registry with: issuer, instrument title, effective date, work type, form identifiers, field schema, formula/rule version, rounding policy, test fixtures, status and replacement/supersession link. The relevant official publication is dated 8 June 2569. [1]

Until a baseline has been approved and its validation fixtures pass, the interface must state **“ยังไม่รับรองความถูกต้องตามมาตรฐาน / ห้ามส่งออก”**. It may not label a generated file as official, correct or ready for procurement.

## Guided AI experience

The assistant is a collapsible contextual panel, not a floating general-purpose chat window. Beginner mode explains one safe next action, why it matters and what evidence is needed; Fast mode collapses the lesson while leaving status, checklist and an explicit “ขอความช่วยเหลือ” action. The response context must contain only the active project revision and authorized summaries. It must include an audit correlation ID and a visible disclaimer when it is describing assumptions or incomplete data.

The first UI release contains deterministic guidance and intentionally has no LLM/API call. The first real-AI release requires an authenticated, rate-limited, schema-validated server endpoint; per-project audit events; entitlement/quota enforcement; signed drawing access; redaction/minimization; and a policy that rejects write, export and approval instructions.

## Required backend additions before production activation

| Capability | New persisted concept | Mandatory tests |
| --- | --- | --- |
| Workflow state | `estimate_workflow_checkpoints` | Cannot unlock/skip; upstream revision invalidates downstream checkpoints. |
| Compliance baseline | `document_baselines`, `document_baseline_versions` | Mapping/version selection; supersession; fixture checksum. |
| Validation | `document_validation_runs` | Required-field, arithmetic, Factor F, rounding and lineage failures block release. |
| Release artifacts | `export_artifacts` | No generation without approved request; artifact checksum and baseline version recorded. |
| Guidance/audit | `guidance_events`, extended `audit_events` | No write authority; user/project scope; quota and redaction enforcement. |

## References

[1] [กระทรวงพาณิชย์: ประกาศคณะกรรมการราคากลางและขึ้นทะเบียนผู้ประกอบการ เรื่อง หลักเกณฑ์และวิธีการกำหนดราคากลางงานก่อสร้าง, ราชกิจจานุเบกษา 8 มิถุนายน 2569](https://www.moc.go.th/th/content/category/detail/id/347/cid/36/iid/10162)
