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
    const { data, error } = await supabase.rpc("rpc_get_customer_portal_summary", {
      p_org_id: session.orgId,
      p_customer_id: session.customerId,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = data as { available_points: number; expiring_3m_points: number };

    return NextResponse.json({
      customer_name: session.customerName,
      available_points: result.available_points,
      expiring_3m_points: result.expiring_3m_points,
    });
  } catch (err) {
    console.error("Portal summary error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
