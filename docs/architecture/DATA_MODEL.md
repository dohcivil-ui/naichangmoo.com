# Initial PostgreSQL Data Model

This is the target logical model. Drizzle schema and migrations implement it in the next roadmap phase. Table names may change only with an ADR or roadmap version explaining the mapping.

## Identity and app access

| Table | Purpose | Key fields |
|---|---|---|
| `users` | Better Auth user identity | `id`, `email`, `name`, timestamps |
| `accounts`, `sessions`, `verification_tokens` | Better Auth persistence | provider/account/session data |
| `organizations` | personal/company/agency ownership boundary | `id`, `kind`, `name`, `created_at` |
| `organization_members` | membership and role | `organization_id`, `user_id`, `role`, `status` |
| `apps` | application registry | `slug`, `access_model`, `display_name`, `enabled` |
| `app_entitlements` | effective access by organization/app | `organization_id`, `app_id`, `state`, `starts_at`, `ends_at`, `limits_json` |
| `billing_customers`, `billing_subscriptions`, `billing_events` | future Stripe mapping only | provider IDs, status, verified event payload hash |

`app_entitlements.limits_json` holds policy values such as `project_limit`, `export_enabled`, `print_enabled`, `ai_enabled`. Server policy resolves limits using state and timestamps; client fields are presentation only.

## Enterprise intake

| Table | Purpose | Key fields |
|---|---|---|
| `enterprise_quotation_requests` | non-binding B2B/agency requirement intake | organization/contact fields, app needs, status, consent timestamp |
| `enterprise_quotation_notes` | internal qualification history | request ID, author, note, created time |

## ESTIMETR domain

| Table | Purpose | Key fields |
|---|---|---|
| `projects` | estimating project | organization, owner, name, work type, lifecycle state |
| `project_members` | project-scoped participants | project/user/role |
| `drawing_documents` | uploaded drawing metadata | project, R2 key, checksum, page count, status |
| `drawing_calibrations` | user-confirmed scale/grid reference | document/page, unit, reference geometry, confidence |
| `takeoff_runs` | AI or manual takeoff run | project, source document, runner, state, input/output hash |
| `takeoff_items` | proposed/confirmed quantities | run, category, unit, quantity, review state |
| `evidence_references` | trace to drawing/source details | takeoff item, page, geometry, source, note |
| `cost_catalog_items` | controlled cost catalogue item | code, name, unit, editable scope |
| `price_sources`, `price_observations`, `price_sets` | price provenance and approved snapshot | source metadata, geo/time, source value, approval, authority source |
| `boq_items` | reviewed preliminary BOQ | project/revision/category/quantity/cost components |
| `estimate_revisions` | immutable revision boundary | project, costing method, number, status, price set (required) |
| `government_form_projections` | derived ปร.4(ก)/ปร.5(ก)/ปร.6 outputs | revision, document type, payload hash, release state |
| `document_releases` | gated export/print release record | revision, type, actor, artifact reference, quality gate result |

## Work queue, Hermes and audit

| Table | Purpose | Key fields |
|---|---|---|
| `background_jobs` | typed platform job lifecycle | type, payload reference/hash, status, retry, idempotency key |
| `hermes_review_jobs` | AI Takeoff evidence review payload/result | background job, immutable snapshot key/hash, result, model metadata |
| `approval_requests` | human approval before external effects | resource type/id, requested action, requester, approver, state |
| `audit_events` | append-only business/security trace | actor, organization, event type, resource, before/after hash, correlation ID |

`hermes_review_jobs` is advisory. It cannot be a foreign-key owner of mutable business data and cannot issue mutation commands. Agents return structured findings that users may accept or dismiss through a separate reviewed action.

## Storage mapping

R2 holds `drawing/{organization}/{project}/{document}`, `evidence/{project}/{run}`, `release/{revision}` and `job-snapshots/{job}`. PostgreSQL stores keys, checksums, MIME type, byte count, scan status and authorization metadata. Signed URLs expire quickly and must never be committed or stored in audit payloads.
