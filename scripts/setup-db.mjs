import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = "https://lootmaywecpedpnnvnyx.supabase.co";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxvb3RtYXl3ZWNwZWRwbm52bnl4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDUzOTc1OCwiZXhwIjoyMDg2MTE1NzU4fQ.xaWy6hdUdKcoyNfadLx5kkHEk6VeKNcHBhxv2kMWxuM";

async function runSQL(sql, label) {
  console.log(`\n>>> Running: ${label}...`);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  if (res.ok) {
    console.log(`    ✅ ${label} — success`);
    return true;
  }

  // Try pg-meta endpoint
  const res2 = await fetch(`${SUPABASE_URL}/pg/query`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      "x-connection-encrypted": "true",
    },
    body: JSON.stringify({ query: sql }),
  });

  if (res2.ok) {
    const data = await res2.json();
    console.log(`    ✅ ${label} — success`);
    return true;
  }

  const err = await res2.text();
  console.error(`    ❌ ${label} — failed: ${err.substring(0, 200)}`);
  return false;
}

async function main() {
  console.log("=== Redeem Points System — Database Setup ===\n");

  // Test connectivity first
  console.log("Testing connection...");
  const testRes = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
  console.log(`Connection test: ${testRes.status} ${testRes.statusText}`);

  // Read migration file
  const migrationPath = resolve(__dirname, "../supabase/migrations/001_init.sql");
  const migrationSQL = readFileSync(migrationPath, "utf-8");

  // Read seed file
  const seedPath = resolve(__dirname, "../supabase/seed.sql");
  const seedSQL = readFileSync(seedPath, "utf-8");

  // Split migration into logical blocks
  const blocks = [];
  let current = "";
  let inFunction = false;

  for (const line of migrationSQL.split("\n")) {
    if (line.match(/^CREATE OR REPLACE FUNCTION|^CREATE TABLE|^CREATE UNIQUE INDEX|^CREATE INDEX|^CREATE TRIGGER|^CREATE OR REPLACE VIEW|^CREATE POLICY|^ALTER TABLE/i)) {
      if (current.trim()) blocks.push(current.trim());
      current = line + "\n";
      if (line.match(/FUNCTION/i)) inFunction = true;
    } else if (inFunction && line.match(/^\$\$ LANGUAGE/i)) {
      current += line + "\n";
      inFunction = false;
    } else if (line.startsWith("-- =")) {
      if (current.trim()) blocks.push(current.trim());
      current = "";
    } else {
      current += line + "\n";
    }
  }
  if (current.trim()) blocks.push(current.trim());

  // Try running the whole migration as one block first
  let success = await runSQL(migrationSQL, "Full migration");

  if (!success) {
    console.log("\n--- Full migration failed, trying block by block ---\n");
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i].trim();
      if (!block || block.startsWith("--")) continue;
      const label = block.substring(0, 60).replace(/\n/g, " ");
      await runSQL(block, `Block ${i + 1}: ${label}...`);
    }
  }

  // Run seed data
  console.log("\n--- Seed Data ---");
  await runSQL(seedSQL, "Seed data");

  console.log("\n=== Setup complete ===");
}

main().catch(console.error);
