# Observed Estimate-BOQ Workflow Reference — 2026-08-22

## Scope and handling

This note records only high-level interface and workflow observations made with the project owner's authorization from `https://doh-thai.com/estimate/`. It does not copy source code, private project data, credentials, or protected files.

## Observed workflow primitives

The reference workspace starts with drawing input and then exposes explicit measurement tools: select, pan, scale, length, area, count, paint/mark, grid, actual distance, snap and ortho. It makes scale status visible and disables scale-dependent measurement tools before calibration.

The BOQ panel keeps project context together with `Factor F`, VAT, advance-payment and retention settings. It exposes distinct entry paths for a manual line, a labor standard, a measurement-derived item and an AI import proposal. It also presents province-price retrieval, Excel selection, PDF printing and separate views for `ปร.4`, `ปร.5` and `ปร.6`.

## Translation to ESTIMETR guidance requirements

1. The assistant should teach the reason for each tool and state its prerequisite, not merely list controls.
2. The assistant must distinguish a suggestion/import from a reviewed BOQ item and must keep price sources separate from measurements.
3. Government-document guidance requires a visible document lineage from prelim BOQ through `ปร.4(ก)`, `ปร.5(ก)` and `ปร.6`, with Factor F and release rules as checks rather than hidden calculations.
4. The assistant must not claim that PDF or Excel is ready until a document-specific quality gate has passed.

## Follow-up inspection

The `ปร.4`, `ปร.5` and `ปร.6` views are available in the reference BOQ panel. On an empty project, all three explicitly report that a BOQ item must first be created in the BOQ edit state. This supports a clear ESTIMETR prerequisite message: document views are projections of reviewed BOQ data, not places to invent or independently enter totals.

## Example project inspection

With owner authorization, a populated example project was opened in read-only mode. It contains a multi-page PDF drawing set and exposes page navigation alongside one central drawing canvas. The visible tool rail retains scale, length, area, count, paint/mark, grid, actual-distance, snap and ortho tools. This confirms that onboarding should teach a user the order **choose drawing context → calibrate scale → choose a measurement/marking tool → retain evidence → review before BOQ**, rather than treating the drawing canvas as an unstructured upload step.

No project values, drawing details, BOQ values, exports or private source content were copied into this note.

## AI and BOQ panel observations from the example

The reference AI panel exposes model selection, discipline presets, a prompt editor, an optional high-detail switch and an explicit analyse action. Its starting prompt is tied to the current drawing page and structural discipline. For ESTIMETR, the useful principle is **context-aware guidance**, but the first onboarding experience should not expose provider/model choice or raw prompt editing to a novice user. Instead, it should explain the next safe action, show what context will be used and make an analysis request explicit.

The reference BOQ panel places project identity, province, Factor F, VAT, advance-payment and retention controls before the editable BOQ rows. It keeps document tabs for `ปร.4`, `ปร.5` and `ปร.6` adjacent to the BOQ workspace. For ESTIMETR, the guided assistant should turn these into a document lineage checklist and explain why each project/price/F-factor field matters before presenting the output controls.

The populated `ปร.4` view is a document projection adjacent to the source BOQ: it presents a structured table of project estimate rows rather than a separate free-form editing canvas. The usable ESTIMETR principle is that the assistant should tell the user **which reviewed BOQ fields feed the projection**, identify missing inputs and return the user to the source row to correct it; it should not invite users to repair downstream document totals directly.

The populated `ปร.5` view summarizes the upstream estimate and places it in the context of direct cost and Factor F rather than duplicating editable BOQ rows. For ESTIMETR, the assistant should explain that `ปร.5` is downstream of reviewed `ปร.4` data and validated government parameters; it must label missing Factor F inputs or unsupported rules as blockers, not replace them with AI-generated assumptions.

The populated `ปร.6` view presents the final summary as a downstream consolidation, not a second estimate editor. The ESTIMETR assistant therefore needs a final release checklist that traces every number back through `ปร.5`, `ปร.4`, the reviewed BOQ, an approved price set and the applicable government parameters. PDF and Excel must remain blocked until that checklist is satisfied and an authorized user approves the release.
