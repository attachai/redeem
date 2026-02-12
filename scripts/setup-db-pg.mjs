import pg from "pg";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Try direct connection first
const connectionString =
  "postgresql://postgres:R8wzp85f%23%24biGQz@db.lootmaywecpedpnnvnyx.supabase.co:5432/postgres";

async function main() {
  console.log("=== Redeem Points System — Database Setup ===\n");

  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    console.log("Connecting to database...");
    await client.connect();
    console.log("✅ Connected!\n");

    // Read migration file
    const migrationPath = resolve(__dirname, "../supabase/migrations/001_init.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    // Read seed file
    const seedPath = resolve(__dirname, "../supabase/seed.sql");
    const seedSQL = readFileSync(seedPath, "utf-8");

    // Run migration
    console.log(">>> Running migration...");
    try {
      await client.query(migrationSQL);
      console.log("✅ Migration completed successfully!\n");
    } catch (err) {
      console.error("❌ Migration error:", err.message);
      console.log("\nTrying to continue with seed data...\n");
    }

    // Run seed data
    console.log(">>> Running seed data...");
    try {
      await client.query(seedSQL);
      console.log("✅ Seed data inserted successfully!\n");
    } catch (err) {
      console.error("❌ Seed error:", err.message);
    }

    // Verify tables exist
    console.log(">>> Verifying tables...");
    const { rows } = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log("Tables in public schema:");
    rows.forEach((r) => console.log(`  - ${r.table_name}`));

    // Verify seed data
    console.log("\n>>> Verifying seed data...");
    const { rows: orgs } = await client.query("SELECT id, name FROM organizations");
    console.log("Organizations:", orgs);

    const { rows: svcs } = await client.query("SELECT id, name, category FROM services");
    console.log("Services:", svcs);

    const { rows: custs } = await client.query("SELECT id, customer_code, full_name FROM customers");
    console.log("Customers:", custs);

    const { rows: rules } = await client.query("SELECT id, service_id, spend_amount, earn_points FROM earning_rules");
    console.log("Earning Rules:", rules);

    console.log("\n=== Setup complete! ===");
  } catch (err) {
    console.error("Fatal error:", err.message);
  } finally {
    await client.end();
  }
}

main();
