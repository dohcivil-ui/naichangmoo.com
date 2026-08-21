# Hermes Agent Runtime Assessment

**Status:** Research only — no Hermes runtime, credential, or messaging gateway is installed by this repository.

## Why a persistent host is relevant

Hermes Agent is a self-hosted autonomous agent with persistent local memory, a messaging gateway, scheduled automations, MCP/tool support and terminal backends. Its own documentation supports Linux installation and a system-service gateway, which makes a continuously running VPS a suitable production target. [1] [2]

For นายช่างหมู, Hermes must never be embedded in a browser request or granted direct, unrestricted access to the production database. It should receive explicitly created background jobs from the platform and return reviewed results through a controlled integration boundary.

## Deployment options

| Approach | Outcome | Cost / complexity | Security trade-off |
|---|---|---|---|
| **A. Isolated Hermes container on the same VPS** | One Hostinger production server runs Next.js, PostgreSQL, Redis and a hardened Hermes container. The app sends signed, typed jobs through a queue. | Lower recurring cost; simpler operations; competes for CPU/RAM with the web/database workload. | Isolation is better than a direct process but the shared host remains a larger blast radius. |
| **B. Dedicated Hermes execution VPS** | Application VPS and agent VPS are separate. The application calls a signed job API/queue, and the agent has no direct database credentials. | Higher recurring cost and more network setup. | Strongest isolation, clearer audit boundary, safer for an agent that can use terminal/browser tools. |
| **C. Delayed agent activation** | Build the job, audit and approval interfaces now; run deterministic tasks only until Hermes use cases are confirmed. | Lowest initial cost; no always-on agent. | Safest initial release but does not satisfy 24/7 Hermes execution. |

## Recommended guardrails regardless of option

1. Run Hermes under a non-root account and isolated container/namespace with a read-only base filesystem.
2. Do not mount the platform repository, PostgreSQL data directory, SSH keys or `.env` files into the agent runtime.
3. Send work through typed jobs with `job_id`, `workspace_id`, `actor_id`, `idempotency_key`, status, immutable input artifact references and a maximum runtime.
4. Require explicit approval before any effect that changes price data, releases documents, sends an external message, modifies infrastructure, makes payment actions or mutates a customer project.
5. Use least-privilege, short-lived credentials and a dedicated service API; Hermes has no direct `DATABASE_URL` or Stripe secret.
6. Log tool invocations, model/provider, input hash, result hash, approval record, retry count and failure reason to an immutable audit table.
7. Implement bounded retry with exponential backoff, a dead-letter queue, a per-workspace concurrency limit and an operator kill switch.
8. Pin and verify Hermes release/artifacts before installation; review the upstream security documentation and changelog before each update.

## Required clarification before activation

The platform needs a declared first use case for Hermes. Examples include reviewing AI-takeoff evidence, reconciling missing price sources, preparing a user-requested summary or handling an internal support queue. The permission set, model cost limit, event trigger and approval gate depend on that choice; do not activate an open-ended agent before it is decided.

## Sources

[1]: https://hermes-agent.nousresearch.com/docs/ "Hermes Agent Documentation"
[2]: https://github.com/NousResearch/hermes-agent "Nous Research — Hermes Agent source repository"
