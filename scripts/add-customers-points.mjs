import pg from "pg";

const client = new pg.Client({
  connectionString: "postgresql://postgres:R8wzp85f%23%24biGQz@db.lootmaywecpedpnnvnyx.supabase.co:5432/postgres",
  ssl: { rejectUnauthorized: false },
});

const ORG_ID = "a0000000-0000-0000-0000-000000000001";
const HOTEL_ID = "b0000000-0000-0000-0000-000000000001";
const RESTAURANT_ID = "b0000000-0000-0000-0000-000000000002";
const CAFE_ID = "b0000000-0000-0000-0000-000000000003";
const HOTEL_RULE = "c0000000-0000-0000-0000-000000000001";
const RESTAURANT_RULE = "c0000000-0000-0000-0000-000000000002";
const CAFE_RULE = "c0000000-0000-0000-0000-000000000003";

// Get admin user_id for created_by
async function getAdminUserId() {
  const res = await client.query(`SELECT user_id FROM profiles WHERE role = 'ADMIN' AND org_id = $1 LIMIT 1`, [ORG_ID]);
  return res.rows[0]?.user_id;
}

async function main() {
  await client.connect();
  console.log("Connected.");

  const adminId = await getAdminUserId();
  if (!adminId) {
    console.error("No admin user found. Run create-test-users.mjs first.");
    await client.end();
    return;
  }
  console.log("Admin user_id:", adminId);

  // 1) Insert customers
  const customers = [
    {
      id: "d0000000-0000-0000-0000-000000000010",
      code: "C010",
      name: "อัตตชัย ช่วยเรือง",
      phone: "0866868471",
      phone_normalized: "66866868471",
      birth_date: "1985-08-04", // 4 สิงหาคม 2528
    },
    {
      id: "d0000000-0000-0000-0000-000000000011",
      code: "C011",
      name: "วิไลลักษณ์ ช่วยเรือง",
      phone: "0804234669",
      phone_normalized: "66804234669",
      birth_date: "1987-07-09", // 9 กรกฎาคม 2530
    },
  ];

  for (const c of customers) {
    try {
      await client.query(
        `INSERT INTO customers (id, org_id, customer_code, full_name, phone, phone_normalized, birth_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (org_id, customer_code) DO NOTHING`,
        [c.id, ORG_ID, c.code, c.name, c.phone, c.phone_normalized, c.birth_date]
      );
      console.log(`Customer: ${c.name} (${c.code})`);
    } catch (e) {
      console.error(`Error inserting ${c.name}:`, e.message);
    }
  }

  // 2) Insert sample point transactions and ledger for both customers
  const now = new Date();
  const sampleData = [
    // อัตตชัย - Hotel stay 5,000 => 50 pts
    {
      customer: customers[0],
      service_id: HOTEL_ID,
      rule_id: HOTEL_RULE,
      spend: 5000,
      points: 50,
      days_ago: 30,
    },
    // อัตตชัย - Restaurant 1,500 => 30 pts
    {
      customer: customers[0],
      service_id: RESTAURANT_ID,
      rule_id: RESTAURANT_RULE,
      spend: 1500,
      points: 30,
      days_ago: 20,
    },
    // อัตตชัย - Cafe 600 => 20 pts
    {
      customer: customers[0],
      service_id: CAFE_ID,
      rule_id: CAFE_RULE,
      spend: 600,
      points: 20,
      days_ago: 5,
    },
    // วิไลลักษณ์ - Hotel 3,000 => 30 pts
    {
      customer: customers[1],
      service_id: HOTEL_ID,
      rule_id: HOTEL_RULE,
      spend: 3000,
      points: 30,
      days_ago: 45,
    },
    // วิไลลักษณ์ - Restaurant 2,000 => 40 pts
    {
      customer: customers[1],
      service_id: RESTAURANT_ID,
      rule_id: RESTAURANT_RULE,
      spend: 2000,
      points: 40,
      days_ago: 15,
    },
    // วิไลลักษณ์ - Cafe 900 => 30 pts
    {
      customer: customers[1],
      service_id: CAFE_ID,
      rule_id: CAFE_RULE,
      spend: 900,
      points: 30,
      days_ago: 3,
    },
    // Some points expiring soon (set expires_at to 2 months from now)
    {
      customer: customers[0],
      service_id: HOTEL_ID,
      rule_id: HOTEL_RULE,
      spend: 2000,
      points: 20,
      days_ago: 300, // old transaction, expires soon
    },
    {
      customer: customers[1],
      service_id: RESTAURANT_ID,
      rule_id: RESTAURANT_RULE,
      spend: 1000,
      points: 20,
      days_ago: 310, // old transaction, expires soon
    },
  ];

  for (let i = 0; i < sampleData.length; i++) {
    const s = sampleData[i];
    const txDate = new Date(now);
    txDate.setDate(txDate.getDate() - s.days_ago);
    const expiresAt = new Date(txDate);
    expiresAt.setDate(expiresAt.getDate() + 365);

    const txId = `e000000${i}-0000-0000-0000-000000000010`;
    const ledgerId = `f000000${i}-0000-0000-0000-000000000010`;

    try {
      // Insert point_transaction
      await client.query(
        `INSERT INTO point_transactions (id, org_id, customer_id, service_id, tx_datetime, spend_amount, rule_id, points_earned, expires_at, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO NOTHING`,
        [txId, ORG_ID, s.customer.id, s.service_id, txDate.toISOString(), s.spend, s.rule_id, s.points, expiresAt.toISOString(), adminId]
      );

      // Insert point_ledger (EARN)
      await client.query(
        `INSERT INTO point_ledger (id, org_id, customer_id, service_id, source_type, source_id, points_delta, occurs_at, expires_at, meta, created_by)
         VALUES ($1, $2, $3, $4, 'EARN', $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO NOTHING`,
        [ledgerId, ORG_ID, s.customer.id, s.service_id, txId, s.points, txDate.toISOString(), expiresAt.toISOString(), JSON.stringify({ spend_amount: s.spend }), adminId]
      );

      console.log(`  TX: ${s.customer.name} +${s.points} pts (${s.spend} THB @ ${s.service_id === HOTEL_ID ? 'Hotel' : s.service_id === RESTAURANT_ID ? 'Restaurant' : 'Cafe'})`);
    } catch (e) {
      console.error(`Error inserting tx for ${s.customer.name}:`, e.message);
    }
  }

  // 3) Add a redeem for อัตตชัย (used 10 points)
  const redeemId = "e1000000-0000-0000-0000-000000000010";
  const redeemLedgerId = "f1000000-0000-0000-0000-000000000010";
  try {
    await client.query(
      `INSERT INTO redeems (id, org_id, customer_id, redeem_datetime, points_redeemed, reward_name, created_by)
       VALUES ($1, $2, $3, $4, 10, 'Free Coffee', $5)
       ON CONFLICT (id) DO NOTHING`,
      [redeemId, ORG_ID, customers[0].id, new Date(now.getTime() - 2 * 86400000).toISOString(), adminId]
    );
    await client.query(
      `INSERT INTO point_ledger (id, org_id, customer_id, source_type, source_id, points_delta, occurs_at, meta, created_by)
       VALUES ($1, $2, $3, 'REDEEM', $4, -10, $5, '{"reward":"Free Coffee"}', $6)
       ON CONFLICT (id) DO NOTHING`,
      [redeemLedgerId, ORG_ID, customers[0].id, redeemId, new Date(now.getTime() - 2 * 86400000).toISOString(), adminId]
    );
    
    // Allocate from earliest earn lot
    const allocId = "e2000000-0000-0000-0000-000000000010";
    const earliestLedger = "f0000006-0000-0000-0000-000000000010"; // days_ago=300
    await client.query(
      `INSERT INTO redeem_allocations (id, org_id, redeem_id, ledger_earn_id, points_used)
       VALUES ($1, $2, $3, $4, 10)
       ON CONFLICT (id) DO NOTHING`,
      [allocId, ORG_ID, redeemId, earliestLedger]
    );
    console.log(`  REDEEM: อัตตชัย -10 pts (Free Coffee)`);
  } catch (e) {
    console.error("Error inserting redeem:", e.message);
  }

  // Summary
  console.log("\n--- Summary ---");
  for (const c of customers) {
    const res = await client.query(
      `SELECT COALESCE(SUM(points_delta), 0) as total FROM point_ledger WHERE customer_id = $1`,
      [c.id]
    );
    console.log(`${c.name}: ${res.rows[0].total} net points`);
  }

  await client.end();
  console.log("Done.");
}

main();
