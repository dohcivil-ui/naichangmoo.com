# Engineering Rules

## Branch and commit discipline

Every new change starts on a dedicated branch. Before every commit, update roadmap version files and run the release/quality command that applies to the current scaffold. A commit without a handoff note is incomplete. Milestones require annotated semantic tags such as `v0.1.0-initial-governance`.

## Data and migrations

Schema is source-controlled. A schema change must include a reviewed Drizzle migration, authorization impact, rollback/risk note and tests. Do not use `db push` as a substitute for a production migration process.

## Authentication and access

Entitlement must be checked by server-side policy on every protected action. Trial locks, read-only retention, app membership, organization boundaries and DOH-only access cannot rely on client-side visibility alone.

## Enterprise quotation intake

The quotation request form may collect organization requirements and a contact channel only after consent. It must not represent a binding offer, create invoices, capture payment data or automatically send external messages.

## Hermes pilot

Hermes only handles `takeoff_evidence_review` jobs. It produces a non-authoritative review summary. Any mutation or external effect needs an explicit approval gate in the application; it is prohibited in the pilot worker.
