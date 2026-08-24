import pg from "pg";

/**
 * Local test fixtures for the back office (ADR 0012, ADR 0013).
 *
 * The back-office pages count rows and search customers, so on an empty database every card reads
 * "ยังไม่มี…" and nothing about them can be tested. This writes a small, deliberate set of rows to
 * exercise them: three organization kinds, three entitlement states, and a quotation request that
 * is already closed so the "ยังไม่ปิด" tile has something to exclude rather than a total to echo.
 *
 * Every row it writes has an id beginning `seed_`, which is what makes `--purge` exact: it removes
 * what this script created and cannot reach a real row. It never touches `platform_administrators`
 * — granting access is a decision, and scripts/grant-platform-admin.mjs is where that lives.
 *
 * Usage:  node --env-file=.env scripts/seed-dev-fixtures.mjs [--purge] [--force]
 *
 * It refuses a database that is not on this machine unless --force is given, because fictional
 * customers seeded into a real one are indistinguishable from real ones afterwards.
 */

const purge = process.argv.includes("--purge");
const force = process.argv.includes("--force");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set. Refusing to guess a database.");
  process.exit(1);
}

const host = (() => {
  try {
    return new URL(connectionString).hostname;
  } catch {
    return "";
  }
})();

if (!["localhost", "127.0.0.1", "::1"].includes(host) && !force) {
  console.error(`Refusing: DATABASE_URL points at "${host}", which is not this machine.`);
  console.error("These are fictional customers. Pass --force only if you are certain.");
  process.exit(1);
}

const DAY = 86_400_000;
const now = Date.now();
const at = (days) => new Date(now + days * DAY);

const users = [
  ["seed_user_somchai", "สมชาย ทองดี", "somchai@thongdee-eng.co.th"],
  ["seed_user_wanida", "วนิดา ศรีสุข", "wanida@nonthaburi.go.th"]
];

const organizations = [
  ["seed_org_personal", "personal", "สมชาย ทองดี (ส่วนบุคคล)"],
  ["seed_org_company", "company", "บริษัท ทองดีวิศวกรรม จำกัด"],
  ["seed_org_gov", "government", "สำนักงานโยธาธิการจังหวัดนนทบุรี"]
];

const members = [
  ["seed_member_personal", "seed_org_personal", "seed_user_somchai", "owner"],
  ["seed_member_company", "seed_org_company", "seed_user_somchai", "owner"],
  ["seed_member_gov", "seed_org_gov", "seed_user_wanida", "owner"]
];

// One entitlement per organization: app_entitlements has a unique index on
// (organization_id, app_id), so three states means three organizations.
const entitlements = [
  ["seed_ent_personal", "seed_org_personal", "trial", at(-2), at(5)],
  ["seed_ent_company", "seed_org_company", "active", at(-30), at(335)],
  ["seed_ent_gov", "seed_org_gov", "suspended", at(-60), null]
];

// Named distinctively so a search for either string proves the back office does not find customers
// by their work.
const projects = [
  [
    "seed_project_office",
    "seed_org_company",
    "seed_user_somchai",
    "อาคารสำนักงาน 3 ชั้น ถนนรัตนาธิเบศร์",
    "building",
    "private"
  ],
  ["seed_project_road", "seed_org_gov", "seed_user_wanida", "ปรับปรุงผิวจราจร สาย นบ.3021", "road", "government"]
];

const quotations = [
  [
    "seed_quote_open_a",
    "หจก. เอกภพก่อสร้าง",
    "เอกภพ ใจดี",
    "ekkaphop@example.co.th",
    "company",
    "ขอใบเสนอราคาสำหรับทีมประมาณราคา 8 คน",
    "submitted"
  ],
  [
    "seed_quote_open_b",
    "เทศบาลนครปากเกร็ด",
    "ปรียา วงศ์งาม",
    "preeya@example.go.th",
    "government",
    "ต้องการใบเสนอราคาเพื่อตั้งงบประมาณปีถัดไป",
    "triaged"
  ],
  [
    "seed_quote_closed",
    "บริษัท สยามพัฒนา จำกัด",
    "สยาม พัฒนกิจ",
    "siam@example.co.th",
    "company",
    "ปิดแล้ว เก็บไว้พิสูจน์ว่าการ์ดไม่นับรายการที่ปิดไปแล้ว",
    "closed"
  ]
];

const client = new pg.Client({ connectionString });
await client.connect();

try {
  await client.query("BEGIN");

  if (purge) {
    // Order matters, and so does the condition. Most seeded rows are found by their own id, but
    // three tables hold rows the APP writes while the back office is exercised — an audit event
    // for an entitlement change, an approval request, a queued job. Those carry generated ids and
    // reference a seeded organization or user through a foreign key with no cascade, so they block
    // the delete unless they go first. They are found by what they point AT, which is what keeps
    // the reach exact: a row naming a real organization or a real actor is not matched.
    const deletions = [
      ["audit_events", "organization_id LIKE 'seed_%' OR actor_id LIKE 'seed_%'"],
      ["approval_requests", "organization_id LIKE 'seed_%' OR requested_by LIKE 'seed_%' OR approved_by LIKE 'seed_%'"],
      ["background_jobs", "organization_id LIKE 'seed_%'"],
      ["enterprise_quotation_requests", "id LIKE 'seed_%'"],
      ["projects", "organization_id LIKE 'seed_%' OR owner_id LIKE 'seed_%'"],
      ["app_entitlements", "id LIKE 'seed_%'"],
      ["organization_members", "id LIKE 'seed_%'"],
      ["organizations", "id LIKE 'seed_%'"],
      ["users", "id LIKE 'seed_%'"]
    ];
    for (const [table, where] of deletions) {
      const { rowCount } = await client.query(`DELETE FROM ${table} WHERE ${where}`);
      console.log(`${table.padEnd(30)} removed ${rowCount}`);
    }
    await client.query("COMMIT");
    console.log("Purged. Nothing outside the seed_ prefix was touched.");
    process.exit(0);
  }

  const { rows: appRows } = await client.query("SELECT id FROM apps WHERE slug = 'estimeter' LIMIT 1");
  if (appRows.length === 0) {
    await client.query("ROLLBACK");
    console.error("No app with slug 'estimeter'. Run the migrations before seeding.");
    process.exit(1);
  }
  const appId = appRows[0].id;

  for (const [id, name, email] of users) {
    await client.query(
      "INSERT INTO users (id, name, email, email_verified) VALUES ($1, $2, $3, true) ON CONFLICT (id) DO NOTHING",
      [id, name, email]
    );
  }

  for (const [id, kind, name] of organizations) {
    await client.query("INSERT INTO organizations (id, kind, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING", [
      id,
      kind,
      name
    ]);
  }

  for (const [id, organizationId, userId, role] of members) {
    await client.query(
      "INSERT INTO organization_members (id, organization_id, user_id, role) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING",
      [id, organizationId, userId, role]
    );
  }

  for (const [id, organizationId, state, startsAt, endsAt] of entitlements) {
    await client.query(
      "INSERT INTO app_entitlements (id, organization_id, app_id, state, starts_at, ends_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING",
      [id, organizationId, appId, state, startsAt, endsAt]
    );
  }

  for (const [id, organizationId, ownerId, name, workType, path] of projects) {
    await client.query(
      "INSERT INTO projects (id, organization_id, owner_id, name, work_type, project_path, state) VALUES ($1, $2, $3, $4, $5, $6, 'active') ON CONFLICT (id) DO NOTHING",
      [id, organizationId, ownerId, name, workType, path]
    );
  }

  for (const [id, orgName, contactName, contactEmail, orgType, note, status] of quotations) {
    await client.query(
      `INSERT INTO enterprise_quotation_requests
         (id, organization_name, contact_name, contact_email, organization_type, requirement_note, consent_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, now(), $7)
       ON CONFLICT (id) DO NOTHING`,
      [id, orgName, contactName, contactEmail, orgType, note, status]
    );
  }

  await client.query("COMMIT");

  const { rows: summary } = await client.query(`
    SELECT 'users' AS table_name, count(*)::int AS seeded FROM users WHERE id LIKE 'seed_%'
    UNION ALL SELECT 'organizations', count(*)::int FROM organizations WHERE id LIKE 'seed_%'
    UNION ALL SELECT 'organization_members', count(*)::int FROM organization_members WHERE id LIKE 'seed_%'
    UNION ALL SELECT 'app_entitlements', count(*)::int FROM app_entitlements WHERE id LIKE 'seed_%'
    UNION ALL SELECT 'projects', count(*)::int FROM projects WHERE id LIKE 'seed_%'
    UNION ALL SELECT 'enterprise_quotation_requests', count(*)::int FROM enterprise_quotation_requests WHERE id LIKE 'seed_%'
  `);
  for (const row of summary) console.log(`${row.table_name.padEnd(30)} ${row.seeded}`);
  console.log("Seeded. Run again with --purge to remove exactly these rows.");
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(`Failed to seed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
