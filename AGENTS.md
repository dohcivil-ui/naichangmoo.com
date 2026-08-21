# Agent Instructions — นายช่างหมู

Read `PROJECT.md`, `CONTEXT.md`, `docs/roadmap/roadmap.json` and the latest file in `docs/handoff/` before changing source code.

## Required workflow

1. Create a dedicated Git branch before adding a feature, migration, security remediation or refactor.
2. Add the work as an unchecked roadmap item before implementation.
3. Update the versioned roadmap and the `roadmap.json` pointer before every commit.
4. Use an ADR only for difficult-to-reverse decisions with real trade-offs. Run the ADR command instructions in `.agent/commands/adr.md`.
5. Run the quality gate required by the changed code before committing.
6. After every commit, add a dated handoff note that states changed files, verification, risk, rollback and next action.
7. Create an annotated semantic Git tag at every project milestone.

## Safety rules

- Never read, print, commit or expose `.env*`, R2 credentials, OAuth provider credentials, Stripe secrets, production data, signed URLs or customer drawing files.
- Hermes is an untrusted execution boundary. It only receives typed review jobs and has no direct database, Stripe or infrastructure secrets.
- Do not make a customer-visible or irreversible change without an explicit user authorization recorded in an approval/audit record.
- Prefer server-side authorization checks over hiding UI controls.

## Design rules

- The UI must remain an engineering tool: one work objective, a short form, validation close to input, visible calculation/evidence and one primary action per state.
- Use source-controlled SVG symbols for UI iconography. Do not use emoji, stock hero images, copied competitor assets or fabricated user content.
- Avoid generic dashboards and decorative cards. Any component must earn its place by helping a user progress through the workflow.
