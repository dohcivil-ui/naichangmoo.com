import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
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
// Which costing stack a project's quantities will be priced through. See ADR 0007: the two
// stacks are not interchangeable, so a project declares one at creation instead of switching.
export const projectPath = pgEnum("project_path", ["private", "government"]);
/**
 * วิธีคิดราคาของฉบับคำนวณหนึ่งฉบับ ตาม ADR 0008 ข้อ 1 และ 2
 *
 * ชื่อบอกว่า **คำนวณด้วยวิธีไหน** ไม่ได้บอกว่าใครเป็นเจ้าของงาน จึงไม่ใช้ `private`/`government`
 * ที่ชนกับ `organization_kind` และไม่ใช้ `cost_plus` ซึ่งเป็นชื่อประเภทสัญญาจ้างที่มีความหมาย
 * ตายตัวอยู่แล้ว โครงการเดียวมีฉบับทั้งสองแบบบนปริมาณชุดเดียวกันได้ ซึ่งเป็นเคสของผู้รับเหมา
 * เอกชนที่ต้องรู้ทั้งราคากลางที่เป็นเพดาน และต้นทุนกับกำไรของตัวเอง
 */
export const costingMethod = pgEnum("costing_method", ["factor_f", "contractor_cost"]);
/**
 * ตัวเลขในชุดราคาชุดนี้มาจากอำนาจไหน ตาม ADR 0008 ข้อ 5
 *
 * เป็นข้อเท็จจริงว่าตัวเลขมาจากไหน ไม่ใช่ระดับความน่าเชื่อถือที่ใครให้คะแนน ฉบับแบบ `factor_f`
 * ใช้ได้เฉพาะชุดที่มาจากแหล่งทางการ การเอาราคาทางการไปใช้ฝั่งผู้รับเหมาไม่ได้ถูกห้าม
 * แต่ต้องคัดลอกเป็นชุดใหม่ที่บันทึกต้นทางไว้ เพื่อไม่ให้ตัวเลขของบริษัทถูกอ้างว่าเป็นราคาทางการ
 */
export const priceAuthoritySource = pgEnum("price_authority_source", ["official", "organization"]);
export const reviewState = pgEnum("review_state", ["proposed", "review_required", "confirmed", "rejected"]);
export const jobState = pgEnum("job_state", ["queued", "running", "succeeded", "failed", "cancelled", "dead_letter"]);
export const approvalState = pgEnum("approval_state", ["pending", "approved", "rejected", "cancelled"]);
// What a person did with something the assistant proposed. `expired` is not an action anybody
// takes; it is what a proposal becomes when nobody decides within its time window.
export const assistantDecision = pgEnum("assistant_decision", [
  "proposed",
  "accepted",
  "rejected",
  "partially_accepted",
  "expired"
]);

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
  // better-auth 1.7 scopes an account's identity by the issuer that vouched for it, and looks a
  // returning member up by (issuer, account_id) rather than by (provider_id, account_id). The
  // column is required by the library, not optional decoration: without it the Drizzle adapter
  // cannot resolve the field and emits a WHERE clause with the column name missing, so every
  // OAuth callback fails at the database. `provider_id` stays because it names which configured
  // provider was used, which is our own concern; the issuer is Google's claim about itself.
  issuer: text("issuer").notNull(),
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

/**
 * The registry of what the platform says about an app publicly. See ADR 0014.
 *
 * A row is not an announcement: `activateEstimeterTrial` inserts one the first time a customer
 * starts a trial, with no administrator involved. `announcedAt` is what an administrator sets, and
 * it is the only thing a public surface may read as a statement. Revoking clears it rather than
 * deleting the row, because `app_entitlements.app_id` cascades and a customer's right to use is not
 * something a copy change may take away.
 */
export const apps = pgTable("apps", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  displayName: text("display_name").notNull(),
  accessModel: text("access_model").notNull(),
  /** Whether the app is open for use, as opposed to announced and still being prepared. */
  enabled: boolean("enabled").notNull().default(true),
  /**
   * The one pre-entry availability sentence (ADR 0010), owned by the registry since ADR 0018.
   * Null means the platform says nothing; the seeded copy in `platform.ts` is only a suggestion
   * an administrator sees in the back office.
   */
  availabilityNote: text("availability_note"),
  announcedAt: timestamp("announced_at", { withTimezone: true }),
  announcedBy: text("announced_by").references(() => users.id),
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
  ipHash: text("ip_hash"),
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
  path: projectPath("project_path").notNull().default("government"),
  // ปร.4, ปร.5 and ปร.6 all print สถานที่ก่อสร้าง and หน่วยงาน in their headers. They are nullable
  // because a project is named before its paperwork is known; the document readiness check that
  // gates output is where their absence has to stop something, not project creation.
  siteLocation: text("site_location"),
  agencyName: text("agency_name"),
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

/**
 * The งานส่วน / หมวดงาน headings a ปร.4 sheet is organised under.
 *
 * A real sheet is not a flat list: อาคารฟอกไต ปุญโญภาส runs 1 งานส่วนที่1 over 1.1 งานดินขุด-ดินถม,
 * 1.2 งานโครงสร้าง, 1.3 งานโครงหลังคา and so on, and prints a subtotal on each heading row. The
 * ลำดับที่ that appears on the form is deliberately NOT stored: it is a position, so deleting 1.2
 * has to renumber everything below it. Storing it would let the paper and the database disagree.
 */
export const takeoffGroups = pgTable("takeoff_groups", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull().references(() => takeoffRuns.id, { onDelete: "cascade" }),
  parentId: text("parent_id").references((): AnyPgColumn => takeoffGroups.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt,
  updatedAt
}, (table) => [
  index("takeoff_groups_run_idx").on(table.runId),
  index("takeoff_groups_parent_idx").on(table.parentId),
  check("takeoff_groups_title_present", sql`length(btrim(${table.title})) > 0`)
]);

export const takeoffItems = pgTable("takeoff_items", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull().references(() => takeoffRuns.id, { onDelete: "cascade" }),
  // A line whose heading is removed becomes ungrouped rather than disappearing: the measurement
  // and its evidence outlive whatever heading someone filed it under.
  groupId: text("group_id").references(() => takeoffGroups.id, { onDelete: "set null" }),
  category: text("category").notNull(),
  description: text("description").notNull(),
  unit: text("unit").notNull(),
  // Net quantity: the sum of the measurement lines with the waste percentage applied. Items
  // created before v0.17.0 carry a typed-in quantity and a null quantityGross, which is how a
  // reader tells a measured quantity from one that was simply asserted.
  quantity: numeric("quantity", { precision: 18, scale: 6 }).notNull(),
  quantityGross: numeric("quantity_gross", { precision: 18, scale: 6 }),
  wastePercent: numeric("waste_percent", { precision: 9, scale: 6 }).notNull().default("0"),
  wasteSourceNote: text("waste_source_note"),
  reviewState: reviewState("review_state").notNull().default("proposed"),
  createdAt,
  updatedAt
}, (table) => [
  // The parser refuses these too, but the parser only runs on the path that happens to call
  // it. An allowance folded into a quantity with no rule behind it is exactly the kind of
  // figure this release exists to prevent, so the database refuses it as well.
  check("takeoff_items_waste_percent_range", sql`${table.wastePercent} >= 0 AND ${table.wastePercent} <= 100`),
  check(
    "takeoff_items_waste_needs_source",
    sql`${table.wastePercent} = 0 OR (${table.wasteSourceNote} IS NOT NULL AND length(btrim(${table.wasteSourceNote})) > 0)`
  ),
  check("takeoff_items_quantity_not_negative", sql`${table.quantity} >= 0`),
  check("takeoff_items_quantity_gross_not_negative", sql`${table.quantityGross} IS NULL OR ${table.quantityGross} >= 0`)
]);

/**
 * The arithmetic behind one take-off quantity, one measured element per row.
 *
 * A quantity that arrives as a single typed number cannot be re-checked in a review meeting:
 * nobody can tell whether 12.5 cu.m came from the right footing or from a slipped decimal.
 * Each row therefore keeps the factors a person actually read off the drawing, and the item
 * quantity is their sum rather than an independent number.
 *
 * How many dimension columns must be filled is decided by the unit, not by the row: a cubic
 * metre needs three, a square metre two, a metre one, a counted unit none. Mass is the
 * exception — steel weight does not come from geometry, so it converts from a measured length
 * through conversionFactor, whose provenance lives in conversionNote.
 */
export const takeoffMeasurements = pgTable("takeoff_measurements", {
  id: text("id").primaryKey(),
  takeoffItemId: text("takeoff_item_id").notNull().references(() => takeoffItems.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  count: integer("count").notNull(),
  dimension1: numeric("dimension_1", { precision: 18, scale: 6 }),
  dimension2: numeric("dimension_2", { precision: 18, scale: 6 }),
  dimension3: numeric("dimension_3", { precision: 18, scale: 6 }),
  conversionFactor: numeric("conversion_factor", { precision: 18, scale: 6 }),
  conversionNote: text("conversion_note"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt,
  updatedAt
}, (table) => [
  index("takeoff_measurements_item_idx").on(table.takeoffItemId),
  // A factor of zero or less is a mistake, not a measurement, and it would silently zero the
  // whole line. How many dimensions a row needs depends on the parent item's unit, so that
  // rule stays in the write path; everything checkable from the row alone is enforced here.
  check("takeoff_measurements_count_positive", sql`${table.count} > 0`),
  check(
    "takeoff_measurements_dimensions_positive",
    sql`(${table.dimension1} IS NULL OR ${table.dimension1} > 0)
      AND (${table.dimension2} IS NULL OR ${table.dimension2} > 0)
      AND (${table.dimension3} IS NULL OR ${table.dimension3} > 0)`
  ),
  // A conversion factor with no stated provenance is an unexplained number in the middle of
  // the arithmetic, which is the one thing a measurement line must never contain.
  check(
    "takeoff_measurements_conversion_needs_source",
    sql`${table.conversionFactor} IS NULL
      OR (${table.conversionFactor} > 0
        AND ${table.conversionNote} IS NOT NULL
        AND length(btrim(${table.conversionNote})) > 0)`
  )
]);

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

/**
 * What a commodity IS, held once instead of once per month. See ADR 0022.
 *
 * A price observation carries a catalogue code and nothing a human can read. The name, the unit
 * and the category belong to the commodity, not to the month, so repeating them on every one of
 * the six monthly rows would be six chances for the same item to disagree with itself.
 */
export const priceCatalogueItems = pgTable("price_catalogue_items", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull().references(() => priceSources.id),
  catalogCode: text("catalog_code").notNull(),
  name: text("name").notNull(),
  unit: text("unit").notNull(),
  categoryCode: text("category_code").notNull(),
  categoryName: text("category_name").notNull(),
  createdAt,
  updatedAt
}, (table) => [uniqueIndex("price_catalogue_items_source_code_unique").on(table.sourceId, table.catalogCode)]);

export const priceObservations = pgTable("price_observations", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull().references(() => priceSources.id),
  catalogCode: text("catalog_code").notNull(),
  provinceCode: text("province_code"),
  effectiveMonth: text("effective_month").notNull(),
  priceExcludingVat: numeric("price_excluding_vat", { precision: 18, scale: 4 }).notNull(),
  // Stored as the publisher sent it rather than derived from the line above. Their rounding is
  // theirs, and a price the screen shows today must not shift by a satang tomorrow merely because
  // it came back from our own copy instead of from theirs.
  priceIncludingVat: numeric("price_including_vat", { precision: 18, scale: 4 }),
  currency: text("currency").notNull().default("THB"),
  // The publisher's own revision stamp for the dataset, not the month the price applies to. A
  // source that revises an old month keeps the same effective month and changes this, which is the
  // only signal that a stored copy has gone out of date. See ADR 0022.
  sourceVersion: text("source_version").notNull(),
  rawPayloadHash: text("raw_payload_hash").notNull(),
  createdAt,
  updatedAt
}, (table) => [
  uniqueIndex("price_observations_reading_unique").on(table.sourceId, table.catalogCode, table.provinceCode, table.effectiveMonth),
  index("price_observations_province_month_idx").on(table.provinceCode, table.effectiveMonth)
]);

export const priceSets = pgTable("price_sets", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  provinceCode: text("province_code").notNull(),
  effectiveMonth: text("effective_month").notNull(),
  status: text("status").notNull().default("draft"),
  /**
   * แหล่งอำนาจของชุด คิดตอนกดส่งจากที่มาของทุกบรรทัด ไม่ใช่ช่องที่ใครเลือกเอง
   *
   * ชุดจะเป็น `official` ก็ต่อเมื่อ **ทุกบรรทัด** มาจากบัญชีที่หน่วยงานรัฐประกาศ บรรทัดเดียว
   * ที่มาจากราคาขององค์กรทำให้ทั้งชุดไม่ใช่ราคาทางการ เพราะยอดรวมของใบเดียวแยกกันไม่ได้
   */
  authoritySource: priceAuthoritySource("authority_source").notNull(),
  payloadHash: text("payload_hash").notNull(),
  createdAt,
  updatedAt
});

/**
 * รายการราคาที่ผู้ใช้หยิบไว้ใน PRICEMETR — ของที่ยังแก้ได้ ยังไม่ผูกโครงการ (IP-163)
 *
 * แยกจาก `price_sets` โดยตั้งใจ ไม่ใช่เพราะขี้เกียจทำ `project_id` ให้ว่างได้
 * **ตะกร้าเปลี่ยนตลอดเวลา ชุดราคาของโครงการต้องนิ่ง** ADR 0008 ถือว่าวิธีคิดราคาเป็นของ
 * revision ราคาที่ขึ้น ปร.4 จึงต้องตรวจย้อนได้ว่ามาจากเดือนไหน สำเนาที่ขยับตามตะกร้าได้
 * จะทำให้เอกสารที่พิมพ์ไปแล้วไม่ตรงกับของจริงโดยไม่มีใครรู้ตัว สองตารางนี้มีอายุคนละแบบ
 * การยัดไว้ตารางเดียวคือการบังคับให้ของสองอายุใช้กฎเดียวกัน
 *
 * เจ้าของคือองค์กร ไม่ใช่คน เพราะโครงการที่ปลายทางเป็นขององค์กรอยู่แล้ว ตะกร้าที่เป็น
 * ของส่วนตัวจะข้ามไปหาโครงการขององค์กรไม่ได้โดยไม่มีใครอธิบายได้ว่าใครอนุญาต
 * ส่วน "ใครหยิบ" จดไว้ทั้งระดับใบและระดับบรรทัด
 */
export const priceBaskets = pgTable("price_baskets", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  createdBy: text("created_by").notNull().references(() => users.id),
  name: text("name").notNull().default("รายการที่หยิบไว้"),
  createdAt,
  updatedAt
}, (table) => [
  // ใบเดียวต่อองค์กรในรุ่นนี้ ตรงกับหน้าจอที่มีตะกร้าใบเดียว ถอดดัชนีนี้ออกวันที่ทำหลายใบ
  uniqueIndex("price_baskets_organization_unique").on(table.organizationId)
]);

/**
 * บรรทัดของตะกร้า พร้อมหลักฐานที่ทำให้ตรวจย้อนได้
 *
 * เดิมหน้าจอเก็บแค่ชื่อ หน่วย ราคา และจำนวน ซึ่งพอสำหรับการคูณให้ดูบนจอ แต่ไม่พอสำหรับ
 * ใบสรุปที่เอกสารเส้นแบ่งสัญญาไว้ว่า "ทุกบรรทัดมีแหล่ง เดือนประกาศ เลขหน้าเอกสาร และ
 * เงื่อนไขปริมาณงานของอัตราค่าแรง" ช่องหลักฐานจึงเก็บตอนหยิบ ไม่ใช่ตอนส่งออก
 * เพราะตอนส่งออกเดือนอาจเปลี่ยนไปแล้ว และเราจะไม่มีทางรู้ว่าตอนเขากดหยิบเขาเห็นอะไร
 */
export const priceBasketLines = pgTable("price_basket_lines", {
  id: text("id").primaryKey(),
  basketId: text("basket_id").notNull().references(() => priceBaskets.id, { onDelete: "cascade" }),
  addedBy: text("added_by").notNull().references(() => users.id),
  /** คีย์เดียวกับที่หน้าจอใช้ เช่น `market:<รหัส>` — กันหยิบซ้ำที่ระดับฐานข้อมูล */
  lineKey: text("line_key").notNull(),
  /** แหล่งของราคา: tpso (สนค.) · obec (สพฐ.) · cgd (ว809) */
  sourceKey: text("source_key").notNull(),
  catalogCode: text("catalog_code").notNull(),
  /** ว่างได้ บัญชี สพฐ. และ ว809 เป็นบัญชีทั้งประเทศ ไม่แยกจังหวัด */
  provinceCode: text("province_code"),
  /** ว่างได้ ด้วยเหตุผลเดียวกัน สองบัญชีนั้นเป็นเล่มรายปี ไม่ใช่ราคารายเดือน */
  effectiveMonth: text("effective_month"),
  /** เลขหน้าในเอกสารต้นฉบับ สำหรับบรรทัดที่มาจากเล่ม */
  documentPage: text("document_page"),
  /** ช่วงปริมาณงานที่ทำให้อัตราค่าแรงบรรทัดนี้ถูกต้อง หยิบผิดช่วงคือขึ้นราคากลางผิด */
  rateCondition: text("rate_condition"),
  name: text("name").notNull(),
  unit: text("unit").notNull(),
  /** เก็บเป็นสตางค์จำนวนเต็ม ไม่ใช่ทศนิยมของบาท เงินที่ปัดเศษเองคือเงินที่อธิบายไม่ได้ */
  unitSatang: bigint("unit_satang", { mode: "bigint" }).notNull(),
  quantity: numeric("quantity", { precision: 18, scale: 4 }).notNull().default("1"),
  createdAt,
  updatedAt
}, (table) => [
  uniqueIndex("price_basket_lines_key_unique").on(table.basketId, table.lineKey),
  index("price_basket_lines_basket_idx").on(table.basketId)
]);

/**
 * บรรทัดของชุดราคาที่ส่งเข้าโครงการแล้ว — สำเนาที่นิ่ง
 *
 * รูปร่างเหมือนบรรทัดของตะกร้าทุกช่อง เพราะมันคือสำเนา ณ วินาทีที่กดส่ง ความต่างอยู่ที่
 * ไม่มีใครแก้มันอีก ตะกร้าต้นทางจะถูกแก้ต่อไปอย่างไรก็ไม่กระทบเอกสารที่พิมพ์ไปแล้ว
 */
export const priceSetLines = pgTable("price_set_lines", {
  id: text("id").primaryKey(),
  priceSetId: text("price_set_id").notNull().references(() => priceSets.id, { onDelete: "cascade" }),
  /** คนที่หยิบบรรทัดนี้เข้าตะกร้าตอนแรก ไม่ใช่คนที่กดส่ง ทั้งสองคนอยู่ในบันทึกตรวจสอบ */
  addedBy: text("added_by").notNull().references(() => users.id),
  lineKey: text("line_key").notNull(),
  sourceKey: text("source_key").notNull(),
  catalogCode: text("catalog_code").notNull(),
  provinceCode: text("province_code"),
  effectiveMonth: text("effective_month"),
  documentPage: text("document_page"),
  rateCondition: text("rate_condition"),
  name: text("name").notNull(),
  unit: text("unit").notNull(),
  unitSatang: bigint("unit_satang", { mode: "bigint" }).notNull(),
  quantity: numeric("quantity", { precision: 18, scale: 4 }).notNull().default("1"),
  createdAt,
  updatedAt
}, (table) => [
  uniqueIndex("price_set_lines_key_unique").on(table.priceSetId, table.lineKey),
  index("price_set_lines_set_idx").on(table.priceSetId)
]);

/**
 * ฉบับคำนวณของโครงการ — ขอบเขตที่ ADR 0008 ให้เป็นเจ้าของวิธีคิดราคา
 *
 * **ชุดราคาห้ามว่าง** ฉบับที่ไม่มีราคาคิดอะไรไม่ได้ ฉบับจึงเกิดจากชุดราคาที่รับมาแล้วเสมอ
 * ไม่ใช่กล่องเปล่าที่รอใครมาเติมทีหลัง และชุดเดียวออกได้ทั้งสองวิธี เพราะเคสที่ ADR 0008
 * ยกมาเป็นเหตุผลหลักคือผู้รับเหมาที่ต้องรู้สองเลขบนปริมาณชุดเดียวกัน
 *
 * **เลขฉบับนับแยกตามวิธีคิด** ตาม ADR 0008 ข้อ 4 เพราะเลขนี้ไปโผล่บนเอกสารที่ยื่นจริง
 * และถูกอ้างในหนังสือโต้ตอบ เลขที่กระโดดหายโดยอธิบายไม่ได้เป็นปัญหาตอนถูกตรวจ
 * ผลคือโครงการไม่มี "ฉบับปัจจุบัน" เดี่ยว ๆ หน้าจอต้องแสดงฉบับล่าสุดของทั้งสองวิธีคู่กันเสมอ
 */
export const estimateRevisions = pgTable("estimate_revisions", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  priceSetId: text("price_set_id").notNull().references(() => priceSets.id),
  costingMethod: costingMethod("costing_method").notNull(),
  revisionNumber: integer("revision_number").notNull(),
  /**
   * ค่าตั้งต้นเป็น `issued` ไม่ใช่ `draft` เพราะ CONTEXT.md นิยามฉบับคำนวณว่าเป็นผลที่แช่แข็ง
   * แล้ว และเขียน _Avoid_ ไว้ตรง ๆ ว่าห้ามเป็น "draft ที่ยังแก้ได้" ฉบับเกิดจากชุดราคาที่นิ่ง
   * อยู่แล้วและไม่มีทางแก้หลังออก การตั้งค่าเริ่มต้นเป็นร่างคือการเปิดช่องให้สถานะที่นิยาม
   * ของโปรเจกต์นี้ห้ามไว้ หลุดเข้าฐานข้อมูลผ่านโค้ดที่ลืมระบุค่า
   */
  status: text("status").notNull().default("issued"),
  createdAt,
  updatedAt
}, (table) => [
  uniqueIndex("estimate_revisions_method_number_unique").on(table.projectId, table.costingMethod, table.revisionNumber),
  index("estimate_revisions_price_set_idx").on(table.priceSetId)
]);

/**
 * บรรทัด BOQ — จุดที่ปริมาณกับราคามาเจอกัน (IP-217)
 *
 * ก่อนหน้านี้ปริมาณที่ถอดไว้กับชุดราคาที่รับมาอยู่บนหน้าเดียวกันคนละแผง และไม่เคยเจอกันเลย
 * คนต้องไล่จับคู่เองทีละบรรทัด ตารางนี้คือที่เก็บคู่ที่จับแล้วและมีคนยืนยันแล้ว
 *
 * **ไม่มีช่องเงินสักช่อง** เป็นกฎเดียวกับที่ schema ของผู้ช่วยถืออยู่ ยอดของบรรทัดคำนวณจาก
 * ราคาต่อหน่วยใน `price_set_lines` คูณปริมาณที่บันทึกไว้ตรงนี้ การเก็บยอดซ้ำคือการเปิดโอกาส
 * ให้ตัวเลขสองที่ขัดกันเองในวันที่ใครสักคนแก้ที่เดียว
 *
 * **ปริมาณถูกคัดลอกมา ไม่ได้อ้างอิงสด** เพราะรายการถอดปริมาณยังแก้ได้ต่อ แต่บรรทัดที่ขึ้น
 * เอกสารไปแล้วต้องนิ่ง ด้วยเหตุผลเดียวกับที่ชุดราคาเป็นสำเนาไม่ใช่ตะกร้า
 *
 * ผูกกับ revision ไม่ใช่กับโครงการ ตาม ADR 0008 ที่ให้เอกสารราคาเป็นของฉบับคำนวณ
 */
export const boqItems = pgTable("boq_items", {
  id: text("id").primaryKey(),
  revisionId: text("revision_id").notNull().references(() => estimateRevisions.id, { onDelete: "cascade" }),
  takeoffItemId: text("takeoff_item_id").notNull().references(() => takeoffItems.id),
  priceSetLineId: text("price_set_line_id").notNull().references(() => priceSetLines.id),
  /** สำเนาปริมาณ ณ วินาทีที่คนกดรับคู่นี้ */
  quantity: numeric("quantity", { precision: 18, scale: 6 }).notNull(),
  /** `assistant` คือผู้ช่วยเสนอแล้วคนรับ · `manual` คือคนจับคู่เอง */
  matchedBy: text("matched_by").notNull().default("manual"),
  /** ระดับความมั่นใจที่ผู้ช่วยให้ไว้ตอนเสนอ ว่างเมื่อคนจับคู่เอง */
  matchConfidence: text("match_confidence"),
  acceptedBy: text("accepted_by").notNull().references(() => users.id),
  createdAt,
  updatedAt
}, (table) => [
  // หนึ่งรายการปริมาณขึ้นได้บรรทัดเดียวต่อฉบับ การรับซ้ำคือการนับปริมาณเดิมสองรอบ
  uniqueIndex("boq_items_revision_takeoff_unique").on(table.revisionId, table.takeoffItemId),
  index("boq_items_revision_idx").on(table.revisionId)
]);

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

/**
 * ADR 0012. Platform administration is a granted row, not a flag on the account, because the
 * question an audit asks is who could change a price on a given day — which a current-state
 * column cannot answer. A revoked grant keeps its row; `revoked_at` is what ends it.
 *
 * The scope is deliberately narrow: platform content and aggregate counts. It carries no right to
 * read another organization's projects, drawings, take-off lines or price sets, which stay behind
 * `projects.organization_id` exactly as before.
 */
export const platformAdministrators = pgTable("platform_administrators", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  /** Null only for the break-glass grant, which has no administrator to attribute it to. */
  grantedBy: text("granted_by").references(() => users.id),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revokedBy: text("revoked_by").references(() => users.id),
  note: text("note"),
  createdAt,
  updatedAt
}, (table) => [index("platform_administrators_user_idx").on(table.userId, table.revokedAt)]);

/**
 * ช่องทางติดต่อของแพลตฟอร์ม (IP-106): LINE OA, เพจ Facebook, อีเมล — ค่าที่ผู้ดูแลกรอกจากหลังบ้าน
 * แถวที่ค่าเป็น null คือช่องที่ยังไม่กรอก และท้ายเว็บจะไม่แสดงช่องนั้นเลย (ซ่อนจนกว่าจะกรอกจริง —
 * คำวินิจฉัยเจ้าของงาน 2026-08-28 แทนการโชว์ค่าปลอม) รายชื่อ key ที่ระบบรู้จักอยู่ใน
 * src/lib/platform-channels.ts ตารางนี้เก็บเฉพาะค่าและคนกรอก ตามแบบเดียวกับทะเบียนแอป
 */
export const platformChannels = pgTable("platform_channels", {
  id: text("id").primaryKey(),
  key: text("key").notNull(),
  value: text("value"),
  updatedBy: text("updated_by").references(() => users.id),
  createdAt,
  updatedAt
}, (table) => [uniqueIndex("platform_channels_key_unique").on(table.key)]);

// Portable fixed-window rate-limit counter. One row per (scope, identifier, window)
// so abuse controls work identically on Vercel and the VPS without extra infrastructure.
export const rateLimitCounters = pgTable("rate_limit_counters", {
  id: text("id").primaryKey(),
  scope: text("scope").notNull(),
  identifier: text("identifier").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull().default(0),
  createdAt,
  updatedAt
}, (table) => [uniqueIndex("rate_limit_counters_unique").on(table.scope, table.identifier, table.windowStart)]);

/**
 * What the assistant proposed, and what a person did about it.
 *
 * The row is written in two steps and the order is the point. It is reserved *before* the model is
 * called, then completed with whatever came back — including a failure. Writing it only on success
 * would mean a crashed or refused call left no trace at all, while the money for it had already
 * left; and a draft somebody rejected would vanish from history, taking with it the one number
 * that says whether the assistant is worth its cost: how often people say no to it.
 *
 * `prompt_hash` is a hash and never the prompt itself. `cost_micro_usd` is an integer in micro USD
 * rather than satang because the baht conversion is a fixed rate in code; storing baht would freeze
 * today's exchange rate into a permanent record.
 */
export const assistantProposals = pgTable("assistant_proposals", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").references(() => organizations.id),
  actorId: text("actor_id").notNull().references(() => users.id),
  appSlug: text("app_slug").notNull(),
  verb: text("verb").notNull(),
  /** What the assistant was working on, recorded verbatim for the audit trail. */
  subject: text("subject").notNull(),
  modelId: text("model_id").notNull(),
  promptHash: text("prompt_hash").notNull(),
  draft: jsonb("draft").notNull().default({}),
  assumptions: jsonb("assumptions").notNull().default([]),
  citations: jsonb("citations").notNull().default([]),
  warnings: jsonb("warnings").notNull().default([]),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  costMicroUsd: integer("cost_micro_usd").notNull().default(0),
  elapsedMs: integer("elapsed_ms").notNull().default(0),
  decision: assistantDecision("decision").notNull().default("proposed"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  decidedBy: text("decided_by").references(() => users.id),
  /** Which fields the person kept when they accepted only part of a proposal. */
  changedFields: jsonb("changed_fields").notNull().default([]),
  /** Set when the reserved call never produced a draft, so a spent call is still explainable. */
  failureReason: text("failure_reason"),
  createdAt,
  updatedAt
}, (table) => [
  // The platform-wide daily spend brake sums this table by time, so the time column leads.
  index("assistant_proposals_created_idx").on(table.createdAt),
  index("assistant_proposals_actor_idx").on(table.actorId, table.createdAt),
  index("assistant_proposals_app_idx").on(table.appSlug, table.verb)
]);

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
  takeoffGroups,
  takeoffItems,
  takeoffMeasurements,
  evidenceReferences,
  priceSources,
  priceCatalogueItems,
  priceObservations,
  priceSets,
  priceSetLines,
  priceBaskets,
  priceBasketLines,
  estimateRevisions,
  boqItems,
  backgroundJobs,
  hermesReviewJobs,
  approvalRequests,
  auditEvents,
  platformAdministrators,
  platformChannels,
  rateLimitCounters,
  assistantProposals
};
