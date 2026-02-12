import { NextResponse } from "next/server";
import { getPortalSession } from "@/lib/portal/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const session = await getPortalSession();
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Get earn lots that are expiring within 3 months
    const now = new Date();
    const threeMonths = new Date(now);
    threeMonths.setMonth(threeMonths.getMonth() + 3);

    // Get all earn lots (positive points with expires_at)
    const { data: earnLots, error: earnErr } = await supabase
      .from("point_ledger")
      .select("id, points_delta, occurs_at, expires_at, services(name)")
      .eq("org_id", session.orgId)
      .eq("customer_id", session.customerId)
      .gt("points_delta", 0)
      .not("expires_at", "is", null)
      .gt("expires_at", now.toISOString())
      .lte("expires_at", threeMonths.toISOString())
      .order("expires_at", { ascending: true });

    if (earnErr) {
      return NextResponse.json({ error: earnErr.message }, { status: 500 });
    }

    if (!earnLots || earnLots.length === 0) {
      return NextResponse.json({ lots: [], total_expiring: 0 });
    }

    // Get allocations (used points) for these lots
    const lotIds = earnLots.map((l) => l.id);
    const { data: allocs } = await supabase
      .from("redeem_allocations")
      .select("ledger_earn_id, points_used")
      .in("ledger_earn_id", lotIds);

    const usedMap: Record<string, number> = {};
    for (const a of allocs || []) {
      usedMap[a.ledger_earn_id] = (usedMap[a.ledger_earn_id] || 0) + a.points_used;
    }

    const lots = earnLots
      .map((lot) => {
        const used = usedMap[lot.id] || 0;
        const remaining = lot.points_delta - used;
        return {
          id: lot.id,
          earned_points: lot.points_delta,
          used_points: used,
          remaining_points: remaining,
          earned_at: lot.occurs_at,
          expires_at: lot.expires_at,
          service_name: (lot.services as unknown as { name: string } | null)?.name || null,
        };
      })
      .filter((l) => l.remaining_points > 0);

    const total_expiring = lots.reduce((sum, l) => sum + l.remaining_points, 0);

    return NextResponse.json({ lots, total_expiring });
  } catch (err) {
    console.error("Portal expiring error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
