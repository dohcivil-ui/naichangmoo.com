# Handoff — `v0.11.1: Vercel Private Git Commit Attribution Recovery`

## Description

The v0.11.0 preview was blocked after the repository became private because Vercel could not associate the prior GitHub noreply commit email with the Vercel project owner. The repository-local Git author identity is now configured with the GitHub email that the user confirmed as verified. This versioned follow-up commit is intended to trigger a new Vercel preview with a recognizable author.

## Changed Scope

| Area | Files | Summary |
|---|---|---|
| Git attribution | Repository-local Git configuration | Uses the user-confirmed GitHub email for subsequent commits; no global Git configuration was changed. |
| Verification record | `docs/verification/vercel-private-repository-deployment-observation-2026-08-22.md` | Records the blocked v0.11.0 Vercel deployment and requires a new preview verification. |
| Release governance | Roadmap, handoff, changelog, package and TODO | Records the recovery action as a separate versioned release rather than altering v0.11.0 history. |

## Verification

The repository-local author identity was read back after configuration. The previous source quality gate for v0.11.0 passed lint, 4 Vitest files / 11 tests, TypeScript, credential-less production build, security preflight, roadmap validation and diff hygiene. GitHub push and the Vercel preview result remain pending this commit.

## Security and data impact

No application runtime behavior, secret, migration, user data, drawing, price set, AI endpoint or export artifact changed. The Git identity is configured only inside this repository and uses an email the user explicitly confirmed as verified for their GitHub account.

## Rollback

Return to `v0.11.0-estimeter-guided-assistant`. No schema or data rollback is required.

## Next action

Push `v0.11.1`, inspect the Vercel preview generated from the new author identity, then mark the preview verification TODO complete only after the deployment reaches `READY`.
