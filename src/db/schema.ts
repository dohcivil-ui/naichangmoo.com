import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex
} from "drizzle-orm/pg-core";

const createdAt = timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const organizationKind = pgEnum("organization_kind", ["personal", "company", "government"]);
export const memberRole = pgEnum("member_role", ["owner", "admin", "member", "viewer"]);
export const entitlementState = pgEnum("entitlement_state", ["trial", "active", "expired_read_only", "suspended", "member_free", "doh_staff_only"]);
export const quoteStatus = pgEnum("enterprise_quote_status", ["submitted", "triaged", "contacted", "proposal_prepared", "closed"]);
export const projectState = pgEnum("project_state", ["draft", "active", "locked", "archived"]);
export const reviewState = pgEnum("review_state", ["proposed", "review_required", "confirmed", "rejected"]);
export const jobState = pgEnum("job_state", ["queued", "running", "succeeded", "failed", "cancelled", "dead_letter"]);
export const approvalState = pgEnum("approval_state", ["pending", "approved", "rejected", "cancelled"]);

// Better Auth tables: field property names intentionally match Better Auth expectations.
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt,
  updatedAt
}, (table) => [uniqueIndex("users_email_unique").on(table.email)]);

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull(),
  createdAt,
  updatedAt,
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" })
}, (table) => [uniqueIndex("sessions_token_unique").on(table.token), index("sessions_user_id_idx").on(table.userId)]);

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt,
  updatedAt
}, (table) => [index("accounts_user_id_idx").on(table.userId)]);

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt,
  updatedAt
});

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  kind: organizationKind("kind").notNull(),
  name: text("name").notNull(),
  createdAt,
  updatedAt
});

export const organizationMembers = pgTable("organization_members", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: memberRole("role").notNull().default("member"),
  createdAt,
  updatedAt
}, (table) => [uniqueIndex("organization_members_unique").on(table.organizationId, table.userId)]);

export const apps = pgTable("apps", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  displayName: text("display_name").notNull(),
  accessModel: text("access_model").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt,
  updatedAt
}, (table) => [uniqueIndex("apps_slug_unique").on(table.slug)]);

export const appEntitlements = pgTable("app_entitlements", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  appId: text("app_id").notNull().references(() => apps.id, { onDelete: "cascade" }),
  state: entitlementState("state").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  limits: jsonb("limits").notNull().default({}),
  createdAt,
  updatedAt
}, (table) => [uniqueIndex("app_entitlements_unique").on(table.organizationId, table.appId)]);

export const enterpriseQuotationRequests = pgTable("enterprise_quotation_requests", {
  id: text("id").primaryKey(),
  organizationName: text("organization_name").notNull(),
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone"),
  organizationType: text("organization_type").notNull(),
  intendedApps: jsonb("intended_apps").notNull().default([]),
  teamSize: integer("team_size"),
  procurementNote: text("procurement_note"),
  requirementNote: text("requirement_note").notNull(),
  consentAt: timestamp("consent_at", { withTimezone: true }).notNull(),
  status: quoteStatus("status").notNull().default("submitted"),
  createdAt,
  updatedAt
});

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  ownerId: text("owner_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  workType: text("work_type").notNull().default("building"),
  state: projectState("state").notNull().default("draft"),
  createdAt,
  updatedAt
}, (table) => [index("projects_organization_id_idx").on(table.organizationId)]);

export const drawingDocuments = pgTable("drawing_documents", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  storageKey: text("storage_key").notNull(),
  checksum: text("checksum").notNull(),
  mimeType: text("mime_type").notNull(),
  byteSize: integer("byte_size").notNull(),
  pageCount: integer("page_count"),
  scanState: text("scan_state").notNull().default("pending"),
  createdAt,
  updatedAt
});

export const takeoffRuns = pgTable("takeoff_runs", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  documentId: text("document_id").references(() => drawingDocuments.id, { onDelete: "set null" }),
  runner: text("runner").notNull(),
  state: jobState("state").notNull().default("queued"),
  inputHash: text("input_hash").notNull(),
  outputHash: text("output_hash"),
  createdAt,
  updatedAt
});

export const takeoffItems = pgTable("takeoff_items", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull().references(() => takeoffRuns.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  description: text("description").notNull(),
  unit: text("unit").notNull(),
  quantity: numeric("quantity", { precision: 18, scale: 6 }).notNull(),
  reviewState: reviewState("review_state").notNull().default("proposed"),
  createdAt,
  updatedAt
});

export const evidenceReferences = pgTable("evidence_references", {
  id: text("id").primaryKey(),
  takeoffItemId: text("takeoff_item_id").notNull().references(() => takeoffItems.id, { onDelete: "cascade" }),
  documentId: text("document_id").references(() => drawingDocuments.id, { onDelete: "set null" }),
  pageNumber: integer("page_number"),
  geometry: jsonb("geometry"),
  note: text("note"),
  createdAt,
  updatedAt
});

export const priceSources = pgTable("price_sources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sourceType: text("source_type").notNull(),
  referenceUrl: text("reference_url"),
  createdAt,
  updatedAt
});

export const priceObservations = pgTable("price_observations", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull().references(() => priceSources.id),
  catalogCode: text("catalog_code").notNull(),
  provinceCode: text("province_code"),
  effectiveMonth: text("effective_month").notNull(),
  priceExcludingVat: numeric("price_excluding_vat", { precision: 18, scale: 4 }).notNull(),
  currency: text("currency").notNull().default("THB"),
  rawPayloadHash: text("raw_payload_hash").notNull(),
  createdAt,
  updatedAt
});

export const priceSets = pgTable("price_sets", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  provinceCode: text("province_code").notNull(),
  effectiveMonth: text("effective_month").notNull(),
  status: text("status").notNull().default("draft"),
  payloadHash: text("payload_hash").notNull(),
  createdAt,
  updatedAt
});

export const estimateRevisions = pgTable("estimate_revisions", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  priceSetId: text("price_set_id").references(() => priceSets.id),
  revisionNumber: integer("revision_number").notNull(),
  status: text("status").notNull().default("draft"),
  createdAt,
  updatedAt
}, (table) => [uniqueIndex("estimate_revisions_project_number_unique").on(table.projectId, table.revisionNumber)]);

export const backgroundJobs = pgTable("background_jobs", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  correlationId: text("correlation_id").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  payloadKey: text("payload_key").notNull(),
  payloadHash: text("payload_hash").notNull(),
  state: jobState("state").notNull().default("queued"),
  attemptCount: integer("attempt_count").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  createdAt,
  updatedAt
}, (table) => [uniqueIndex("background_jobs_idempotency_unique").on(table.idempotencyKey)]);

export const hermesReviewJobs = pgTable("hermes_review_jobs", {
  id: text("id").primaryKey(),
  backgroundJobId: text("background_job_id").notNull().references(() => backgroundJobs.id, { onDelete: "cascade" }),
  takeoffRunId: text("takeoff_run_id").notNull().references(() => takeoffRuns.id),
  snapshotKey: text("snapshot_key").notNull(),
  snapshotHash: text("snapshot_hash").notNull(),
  resultKey: text("result_key"),
  modelMetadata: jsonb("model_metadata"),
  createdAt,
  updatedAt
});

export const approvalRequests = pgTable("approval_requests", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id").notNull(),
  requestedAction: text("requested_action").notNull(),
  requestedBy: text("requested_by").notNull().references(() => users.id),
  approvedBy: text("approved_by").references(() => users.id),
  state: approvalState("state").notNull().default("pending"),
  createdAt,
  updatedAt
});

export const auditEvents = pgTable("audit_events", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").references(() => organizations.id),
  actorId: text("actor_id").references(() => users.id),
  eventType: text("event_type").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id").notNull(),
  correlationId: text("correlation_id"),
  beforeHash: text("before_hash"),
  afterHash: text("after_hash"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt
}, (table) => [index("audit_events_resource_idx").on(table.resourceType, table.resourceId)]);

export const schema = {
  users,
  sessions,
  accounts,
  verifications,
  organizations,
  organizationMembers,
  apps,
  appEntitlements,
  enterpriseQuotationRequests,
  projects,
  drawingDocuments,
  takeoffRuns,
  takeoffItems,
  evidenceReferences,
  priceSources,
  priceObservations,
  priceSets,
  estimateRevisions,
  backgroundJobs,
  hermesReviewJobs,
  approvalRequests,
  auditEvents
};
