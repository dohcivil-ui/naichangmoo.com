# Handoff — 2026-08-23 — ESTIMETR Manual Take-off with Evidence (v0.15.0)

## What this release does

Slice 2 created projects. This slice puts numbers in them. A member opens a manual take-off
run on a project, records lines with a unit and a quantity, states where each quantity was
measured from, and confirms the line. Only confirmed lines are totalled, and closing a run
stores a fingerprint of exactly those lines so a later estimate can prove which quantities it
priced.

Three rules carry the engineering weight here:

1. **Units are a closed set with a physical dimension.** Free text would accept "ตร.ม.",
   "ตรม." and "m2" and then sum them as three different things. Quantities are never merged
   across units, not even within a dimension: ตัน and กก. are shown separately rather than
   converted behind the user's back.
2. **Quantities are decimal strings summed as scaled integers.** `0.1 + 0.2` as a float is
   `0.30000000000000004`; a bill of quantities cannot carry that. Nothing is rounded at this
   stage, because no money is derived from it yet.
3. **A quantity with no stated source cannot be confirmed.** The evidence count is read inside
   the same transaction that flips the state, behind a row lock on the item, so evidence
   cannot be removed between the check and the write.

## Changed files

| File | Change |
|---|---|
| `src/lib/takeoff-units.ts` | new. Closed unit set with dimensions, and the work-group categories. |
| `src/lib/takeoff-quantity.ts` | new. Decimal parsing, exact scaled-integer addition, display formatting. |
| `src/lib/takeoff-quantity.test.ts` | new. Parsing, refusals, the `numeric(18,6)` boundary, exact addition. |
| `src/lib/takeoff-item.ts` | new. Item and evidence form parsing, and the confirmation gate. |
| `src/lib/takeoff-item.test.ts` | new. Field validation and the evidence gate per review state. |
| `src/lib/takeoff-summary.ts` | new. Confirmed totals per unit, ordered volume → area → length → mass → count. |
| `src/lib/takeoff-summary.test.ts` | new. Confirmed-only totals and the refusal to merge units. |
| `src/server/estimeter/takeoff-repository.ts` | new. All take-off reads and writes, every one joined back to `projects` for the organization filter. |
| `src/server/estimeter/takeoff-repository.integration.test.ts` | new. Opt-in PostgreSQL tests, including the item lock proof. |
| `src/server/actions/estimeter-takeoff.ts` | new. Six actions, each re-checking session, entitlement and organization. |
| `src/app/apps/estimeter/projects/[projectId]/takeoff/page.tsx` | new. The take-off screen: run state, line table, evidence, totals. |
| `src/app/apps/estimeter/projects/[projectId]/page.tsx` | now shows real take-off progress and confirmed totals instead of four placeholder stages. |
| `src/components/estimeter/takeoff/add-item-form.tsx` | new. One-line entry form built for continuous keyboard entry. |
| `src/components/estimeter/takeoff/add-evidence-form.tsx` | new. Source note and optional page reference. |
| `src/components/estimeter/takeoff/takeoff-action-button.tsx` | new. One form per state change, with the blocking reason shown next to the disabled control. |
| `src/app/globals.css` | new take-off form, evidence and row-action classes; existing panel and table classes reused. |
| `docs/roadmap/roadmap.v0.15.0.json`, `roadmap.json`, `CHANGELOG.md`, `docs/handoff/index.json`, `package.json` | governance and version records. |

No schema change and no migration. `takeoff_runs`, `takeoff_items`, `evidence_references` and
`audit_events` are used as shipped by migration 0000.

## How the existing columns were used

- `takeoff_runs.runner = 'manual'`, `state` moves `running → succeeded` on close.
- `takeoff_runs.input_hash` is NOT NULL and was designed for a computed run. A manual run has
  no machine input, so it stores a hash of the project, runner and operator that opened it.
- `takeoff_runs.output_hash` is written on close, over the confirmed lines only.
- `evidence_references.page_number` holds the drawing page; `note` holds the written source.
  `document_id` stays null because drawing upload does not exist yet.

## Verification

- `pnpm typecheck`, `pnpm lint` (0 warnings), `pnpm build`, `pnpm security:check` pass.
- `pnpm test` with `ESTIMETR_DB_TESTS=1`: 19 files / 94 tests passed.
- Hand check against the code: four beams at 0.20 × 0.40 × 6.00 m are 0.48 cu.m each and
  1.92 cu.m together, which is what the sum returns; `12.345678` maps to `12345678` scaled
  units and back without loss.
- The item lock test was written twice, the same way slice 2's was. A test that simply fired
  two confirmations concurrently passed even with `.for("update")` removed, so it proved
  nothing. It was replaced with a test that holds the item lock open, confirms inside the
  holding transaction, and requires the second confirmation to wait and then be refused.
  Without the row lock that test fails: one quantity is confirmed twice and two audit events
  are written for it.
- Unauthenticated requests to `/apps/estimeter`, `/apps/estimeter/projects/{id}` and
  `/apps/estimeter/projects/{id}/takeoff` returned the access gate.

## Risk

- **The arithmetic behind a quantity cannot be re-checked.** `takeoff_items` has no column for
  a dimension breakdown, so the measurement basis is a note in the operator's own words. A
  reviewer can see the claimed source but cannot recompute `0.20 × 0.40 × 6.00 × 4` from
  stored fields. This is the honest limit of working without a migration, and it is the reason
  IP-045 exists. Do not paper over it by writing dimensions into `evidence_references.geometry`,
  which means something else.
- **Categories are working groups, not ปร.4 groups.** The five categories are ordinary trade
  groupings. Mapping them to the official form needs the DPT source (IP-042). Nothing in this
  release claims form compliance.
- **A confirmed line cannot be corrected.** Confirmation locks the line to protect the audit
  trail, and there is no reject-and-revise action yet. A wrong confirmed quantity currently has
  to stay and be superseded by a new line. If this bites in use, the fix is a reject action
  that records who reversed the confirmation, not making confirmed lines editable.
- **One open run per project.** Deliberate: two open runs would let two quantity sets be
  priced at once. A second operator has to work in the same run.
- **No price anywhere.** No Factor F, no VAT, no unit price. The screen deliberately shows
  quantities only, so nothing on it can be mistaken for a cost estimate.

## Rollback

Revert this commit, or return to tag `v0.14.0-estimeter-project-lifecycle`. No migration runs.
Rows already written to `takeoff_runs`, `takeoff_items`, `evidence_references` and
`audit_events` stay valid and simply become unreachable until the route returns.

## Next action

1. User approval, then push `feature/estimeter-manual-takeoff` and tag
   `v0.15.0-estimeter-manual-takeoff`.
2. Slice 4 — drawing document upload and evidence binding: replace the written drawing
   reference with a stored document, page and region, using `drawing_documents` and the
   existing `evidence_references.document_id` and `geometry` columns. Still no migration, but
   it needs an R2 decision, checksum handling and an upload scan path.
3. Slice 5 — pricing. This is the first slice that requires a migration (BOQ line items, price
   units, Factor F and tax parameters) and it cannot start without the source documents: the
   official reference price publication and the Factor F table that applies to building work,
   with their issue dates. No number in those tables will be invented.
