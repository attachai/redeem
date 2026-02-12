import pg from "pg";

const client = new pg.Client({
  connectionString: "postgresql://postgres:R8wzp85f%23%24biGQz@db.lootmaywecpedpnnvnyx.supabase.co:5432/postgres",
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  console.log("Connected.");

  const sqls = [
    `ALTER TABLE point_ledger ADD CONSTRAINT point_ledger_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(user_id)`,
    `ALTER TABLE redeems ADD CONSTRAINT redeems_created_by_profiles_fkey FOREIGN KEY (created_by) REFERENCES profiles(user_id)`,
  ];

  for (const sql of sqls) {
    try {
      await client.query(sql);
      console.log("OK:", sql.substring(0, 80));
    } catch (e) {
      if (e.message.includes("already exists")) {
        console.log("SKIP (already exists):", sql.substring(0, 80));
      } else {
        console.error("ERR:", e.message);
      }
    }
  }

  await client.end();
  console.log("Done.");
}

main();
