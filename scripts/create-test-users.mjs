import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://lootmaywecpedpnnvnyx.supabase.co";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxvb3RtYXl3ZWNwZWRwbm52bnl4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDUzOTc1OCwiZXhwIjoyMDg2MTE1NzU4fQ.xaWy6hdUdKcoyNfadLx5kkHEk6VeKNcHBhxv2kMWxuM";

const ORG_ID = "a0000000-0000-0000-0000-000000000001";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const testUsers = [
  {
    username: "admin",
    password: "admin123",
    display_name: "ผู้ดูแลระบบ",
    role: "ADMIN",
  },
  {
    username: "staff",
    password: "staff123",
    display_name: "พนักงานทั่วไป",
    role: "STAFF",
  },
];

async function main() {
  console.log("=== Creating Test Users ===\n");

  for (const u of testUsers) {
    const email = `${u.username}@redeem.local`;
    console.log(`Creating user: ${u.username} (${u.role})...`);

    // Check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const existing = existingUsers?.users?.find((x) => x.email === email);

    let userId;

    if (existing) {
      console.log(`  User "${u.username}" already exists (${existing.id}), updating password...`);
      await supabase.auth.admin.updateUserById(existing.id, { password: u.password });
      userId = existing.id;
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: u.password,
        email_confirm: true,
      });

      if (error) {
        console.error(`  ❌ Failed to create auth user: ${error.message}`);
        continue;
      }
      userId = data.user.id;
      console.log(`  ✅ Auth user created: ${userId}`);
    }

    // Upsert profile
    const { error: profErr } = await supabase
      .from("profiles")
      .upsert(
        {
          user_id: userId,
          org_id: ORG_ID,
          role: u.role,
          display_name: u.display_name,
        },
        { onConflict: "user_id" }
      );

    if (profErr) {
      console.error(`  ❌ Failed to create profile: ${profErr.message}`);
    } else {
      console.log(`  ✅ Profile created/updated: ${u.display_name} (${u.role})`);
    }
  }

  console.log("\n=== Test Users Ready ===");
  console.log("┌──────────────────────────────────────┐");
  console.log("│  Username  │  Password  │  Role       │");
  console.log("├──────────────────────────────────────┤");
  console.log("│  admin     │  admin123  │  ADMIN      │");
  console.log("│  staff     │  staff123  │  STAFF      │");
  console.log("└──────────────────────────────────────┘");
}

main().catch(console.error);
