# Source and AI Boundary Security Review — 2026-08-22

## Scope

This review covers the current public GitHub repository, the ESTIMETR pilot source structure and the intended server-side AI guidance boundary. It does not claim a penetration test or a guarantee against compromise.

## Observed state

| Area | Observation | Risk interpretation |
| --- | --- | --- |
| Repository visibility | `dohcivil-ui/naichangmoo.com` is public. | Source code is intentionally readable by anyone; it must never contain credentials, customer drawings, private price data or production configuration. |
| Source branch | `initial-project/nextjs-scaffold` has no GitHub branch protection. | Anyone with write access can push directly; accidental or unauthorized changes have a larger blast radius. |
| GitHub Actions | Actions are enabled, allow all actions and do not require SHA pinning. | Third-party workflow use would need a constrained allowlist and immutable action revisions before workflows are added. |
| Local source hygiene | `.env` and `.env.*` are ignored; the security script rejects tracked environment/credential files and build artifacts. | A useful baseline, but it is not a complete secret-scanning or access-control program. |
| GitHub secret scanning | Secret scanning and push protection are enabled; non-provider patterns and validity checks are disabled. | Known provider secrets receive an additional defense, but custom token formats and validation coverage remain incomplete. |
| Dependency updates | Dependabot security updates are disabled. | Vulnerable dependency remediation is not automatically proposed by GitHub. |
| AI/agent boundary | Current architecture keeps LLM/Hermes calls server-side; Hermes is advisory-only and lacks direct mutation credentials. | The boundary is appropriate for a first AI guidance release, provided every endpoint performs authentication, entitlement and rate-limit checks. |

## Recommended control set before real AI/data activation

1. Move the source repository to **private** if the user does not intend it as an open-source project. This hides implementation detail but is not a substitute for server-side security.
2. Protect the deployment branch: require pull requests, passing CI checks, review by a code owner, and prevent force pushes/deletions.
3. Restrict GitHub Actions to an approved allowlist and pin any third-party action to an immutable commit SHA before adding workflows.
4. Enable Dependabot security updates and consider non-provider secret patterns after reviewing the expected custom token formats.
5. Keep all provider/database/R2/Stripe/Hermes credentials only in the hosting secret manager. Never put secrets, real customer files or private rate tables in Git, browser code, logs or AI prompts.
6. Require server-side authentication, app entitlement, organization/project authorization, input validation, output schema validation, rate limits and audit events for every AI request.
7. Use per-project signed storage access and malware/file-type validation before AI reads drawings. Redact or minimize personally identifiable data in prompts.
8. Keep the Guided AI Assistant advisory-only. It may explain, flag missing prerequisites and propose next actions, but cannot commit price changes, approve documents, export a final PDF or send data outside the approved boundary.

## Decision required from owner

Changing repository visibility or GitHub branch/action settings can affect collaborators and deployment integration. Make no such external setting change without explicit owner approval.

## Applied controls — 2026-08-22

With owner approval, repository visibility was changed from public to private. GitHub vulnerability alerts and Dependabot security updates were enabled. GitHub Actions is now restricted to selected actions, requires full-length SHA pinning and allows GitHub-owned actions only; the committed CI workflow uses SHA-pinned official `actions/checkout` and `actions/setup-node` steps with read-only token permissions.

GitHub rejected branch-protection configuration for this private repository because the current plan does not support protected branches on private repositories. Until an eligible GitHub plan is available, the fallback control is a SHA-pinned CI workflow plus the existing local pre-commit/release gates. Direct push prevention and mandatory GitHub review cannot be technically enforced on this private repository without changing plan eligibility or making the repository public again; neither fallback should be presented as equivalent branch protection.
