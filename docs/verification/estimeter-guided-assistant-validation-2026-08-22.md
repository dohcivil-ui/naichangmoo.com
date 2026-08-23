# ESTIMETR Guided AI Assistant Validation — 2026-08-22

## Scope

This record covers the deterministic interactive mockup only. It does not validate real AI, drawing upload, TPSO ingestion, price sets, Factor F, DPT/CGD form mapping, Excel/PDF generation or production authorization.

## Automated checks

| Check | Result |
| --- | --- |
| ESLint | Pass |
| Vitest | Pass — 4 files / 11 tests |
| TypeScript | Pass |
| Credential-less Vercel production build | Pass after CSS hygiene correction |

## Workflow-policy coverage

The pure workflow module verifies that the user cannot unlock take-off without project path, confirmed scale and drawing review. It also verifies that BOQ/document readiness requires take-off review, an approved price set and a cost review. The blocker returned to the user is explicit rather than silently allowing a stage jump.

## Visual review

| Viewport | Result |
| --- | --- |
| Desktop 1440 × 1400 | The four-stage rail, project-path control, scale confirmation, locked action, workspace panel and contextual assistant rail fit in a readable engineering-workbench layout. |
| Mobile 375 × 1200 | Header, workflow progress, disclaimer and horizontal stage rail remain readable. The stage rail intentionally scrolls horizontally; the assistant becomes a normal in-flow panel at the tablet/mobile breakpoint. |

## Guardrail assertions visible in UI

The UI labels all values as a demonstration; no export action exists. Before price-set approval, the cost review action is disabled and visibly desaturated. At document readiness, the UI explicitly states that a baseline, calculation fixture, Factor F/rounding validation, user approval and output checksum are still absent, so Excel/PDF release remains locked.
