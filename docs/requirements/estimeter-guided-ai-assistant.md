# ESTIMETR Guided AI Assistant — Requirement Summary

## Product outcome

ESTIMETR must teach a first-time user to perform a traceable construction estimate in the application itself, while allowing an experienced estimator to dismiss instruction and request contextual help only when needed. The experience must feel like a focused engineering workbench, not a generic chatbot or a dense dashboard.

## Settled product decisions

| Decision | Agreed direction |
| --- | --- |
| Assistant format | A contextual, collapsible Guided AI Assistant within the Workspace. It offers a start lesson, step checklist, “ask for help” entry point and explicit next action. |
| Learning modes | Beginner mode provides short explanations and prerequisites. Fast mode hides nonessential teaching and leaves the checklist/help entry point available. |
| Project path | The user chooses private or government work at project setup. Guidance, required fields and readiness gates follow that path. |
| AI authority | Advisory only. It can teach, explain gaps, identify items needing review and propose next actions. It cannot invent prices, write business data, approve documents, produce a release or communicate externally on its own. |
| Output truthfulness | The UI may only label ปร.4(ก), ปร.5(ก), ปร.6, Excel or PDF ready after explicit data, review, permission and release gates pass. |
| Document lineage | Government path is Prelim BOQ → ปร.4(ก) → ปร.5(ก) → ปร.6 → release. Private path is reviewed BOQ → direct cost → OH&P/profit/VAT → quotation/release. |

## Teaching journey

| Stage | What the assistant teaches | Required evidence or confirmation | Guidance outcome |
| --- | --- | --- | --- |
| 0. Start project | Choose private/government path; capture project identity and province/month context. | Project setup confirmed. | Opens drawing/calibration lesson. |
| 1. Drawing and scale | Open drawings, select page/discipline, set scale from a known dimension and understand confidence. | Calibration reference/evidence and user confirmation. | Enables measurement/take-off guidance. |
| 2. Take-off and evidence | Select appropriate measuring tool, mark/count/measure, keep formula, unit and page/geometry evidence. | Each proposed item reviewed or marked for review. | Opens preliminary BOQ. |
| 3. Unit cost and price context | Separate material/labor, attach source/version/province/month and flag missing price evidence. | Price set approved for the project revision. | Opens BOQ review. |
| 4. BOQ review | Review quantity × unit cost, categories, assumptions and change history. | BOQ review passed by authorized user. | Enables path-specific document projection. |
| 5. Documents and release | Explain ปร.4(ก) → ปร.5(ก) → ปร.6 + Factor F for government, or OH&P/profit/VAT for private work. | Document-specific validation and release approval. | Offers permitted Excel/PDF release action. |

## Security and operating boundary

The real LLM must be called from a policy-guarded server endpoint only. Every request must verify authenticated member, app entitlement, organization/project authorization, rate limit, input/output schema and audit event. Prompts must be scoped to the minimum project data necessary. Drawing files require signed access and validation before analysis. Hermes remains a separate typed, advisory-only take-off evidence reviewer as defined by ADR 0004.

## Deferred from this UI-first release

Persistent projects, uploaded drawings, calibration storage, real LLM calls, TPSO price retrieval, approved price sets, formal government projection engine, Excel/PDF generation and release approvals remain separate backend milestones. The UI must present their status honestly rather than simulate a real export.
