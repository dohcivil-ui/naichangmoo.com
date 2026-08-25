import { randomUUID } from "node:crypto";
import pg from "pg";

/**
 * Break-glass grant for the first platform administrator (ADR 0012).
 *
 * A system with no administrator cannot let anyone into the back office, and the first grant has
 * nobody to attribute itself to. This script is that one exception, and it is deliberately not a
 * general-purpose tool: it refuses the moment a single unrevoked administrator exists, so it works
 * once from empty and never again. Later grants go through the back office, by an administrator,
 * with that administrator recorded.
 *
 * Usage:  node scripts/grant-platform-admin.mjs someone@example.com ["reason"]
 *
 * It needs DATABASE_URL and never prints it. The person must already have signed in at least once,
 * because the grant points at a real users row rather than creating an account out of an email.
 */

const email = process.argv[2]?.trim().toLowerCase();
const note = process.argv[3]?.trim() || null;

if (!email || !email.includes("@")) {
  console.error("Usage: node scripts/grant-platform-admin.mjs <email> [note]");
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set. Refusing to guess a database.");
  process.exit(1);
}

const client = new pg.Client({ connectionString });
await client.connect();

try {
  await client.query("BEGIN");

  // Lock the table for the duration so two concurrent runs cannot both see an empty table and
  // both decide they are the bootstrap.
  await client.query("LOCK TABLE platform_administrators IN SHARE ROW EXCLUSIVE MODE");

  const { rows: active } = await client.query(
    "SELECT pa.id, u.email FROM platform_administrators pa JOIN users u ON u.id = pa.user_id WHERE pa.revoked_at IS NULL"
  );

  if (active.length > 0) {
    await client.query("ROLLBACK");
    console.error(
      `Refusing: ${active.length} platform administrator(s) already active (${active
        .map((row) => row.email)
        .join(", ")}).`
    );
    console.error("This script only bootstraps an empty system. Grant further access from the back office.");
    process.exit(1);
  }

  const { rows: found } = await client.query("SELECT id, email FROM users WHERE lower(email) = $1 LIMIT 1", [email]);
  if (found.length === 0) {
    await client.query("ROLLBACK");
    console.error(`No user with email ${email}. They must sign in once before they can be granted access.`);
    process.exit(1);
  }

  const user = found[0];
  const administratorId = randomUUID();

  await client.query(
    "INSERT INTO platform_administrators (id, user_id, granted_by, note) VALUES ($1, $2, NULL, $3)",
    [administratorId, user.id, note]
  );

  await client.query(
    `INSERT INTO audit_events (id, actor_id, event_type, resource_type, resource_id, metadata)
     VALUES ($1, NULL, 'platform_admin.bootstrapped', 'platform_administrator', $2, $3)`,
    [randomUUID(), administratorId, JSON.stringify({ email: user.email, note, via: "scripts/grant-platform-admin.mjs" })]
  );

  await client.query("COMMIT");

  console.log(`Granted platform administration to ${user.email}.`);
  console.log(`administrator id: ${administratorId}`);
  console.log("An audit event of type platform_admin.bootstrapped records this grant.");
  console.log("This script will now refuse to run again until every administrator is revoked.");
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(`Failed to grant platform administration: ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
