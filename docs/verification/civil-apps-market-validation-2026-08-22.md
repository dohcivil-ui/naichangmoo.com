# Civil Apps Market Validation — 2026-08-22

## Scope checked

The marketplace landing and all app-detail routes were checked locally before release. The review focuses on the approved direct-reading interaction: category heading followed immediately by its related application card, without a filter, launcher, search step or misleading availability state.

## Browser and visual results

| Surface | Result |
|---|---|
| Desktop Landing | The hero describes the market, then each work category directly exposes its corresponding application card. ESTIMETR appears under ประมาณราคางานอาคาร; the three remaining apps appear under the user-approved engineering, safety-equipment and land-acquisition categories. |
| Mobile Landing | The hero and category/card flow stack vertically. App actions remain in the card instead of being hidden behind filtering controls. |
| ESTIMETR detail | `/market/estimeter` displays preparation, guided flow, access state and a free 5-day start action before the workspace route. The access panel contrast was corrected after visual review. |
| Coming-soon detail | `/market/rcopt` describes the app and its preparation/flow, while explicitly withholding workspace entry until the rewritten app is ready. |
| Direct flow | Browser navigation from the ESTIMETR card reaches `/market/estimeter` directly; the detail action points to `/apps/estimeter`. |

## Guardrails confirmed

The catalog makes no numeric price claim. It keeps the ESTIMETR free 5-day message, preserves member-free/restricted labels, and does not present a coming-soon or restricted workspace as usable. App-detail copy retains the distinction between current UI pilot behavior and future real price/export capability.

## Automated checks before release metadata

Lint, TypeScript and Vitest passed after implementation. The Civil Apps Market registry has dedicated tests for all four approved category labels, category mappings and detail data presence. The full credential-less production quality gate remains required after roadmap/handoff versioning.
