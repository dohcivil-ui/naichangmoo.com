# Command: `adr`

Use this command when a decision is expensive to reverse, surprising without context, and involves a real trade-off.

## Invocation

```text
adr <short-kebab-case-title>
```

## Required procedure

1. Read `PROJECT.md`, `CONTEXT.md`, `docs/roadmap/roadmap.json` and the latest ADR.
2. Confirm that the decision qualifies for an ADR. If it does not, add the decision to the roadmap or handoff note instead.
3. Find the highest sequence in `docs/adr/` and create the next file as `NNNN-<short-kebab-case-title>.md`.
4. Use this structure:

```md
# ADR NNNN: <Decision title>

**Status:** Accepted | Superseded | Proposed

## Context

Why this decision is necessary now.

## Decision

The choice that has been made.

## Alternatives considered

| Alternative | Why not selected now |
|---|---|
| ... | ... |

## Consequences

Operational, security, cost, migration and testing implications.
```

5. Add the ADR reference to the current roadmap version and update `docs/roadmap/roadmap.json`.
6. Include the ADR in the next handoff note and commit message.

## Do not create ADRs for

Minor naming, routine bug fixes, ordinary UI spacing, temporary experiments or decisions that are easily reversible.
