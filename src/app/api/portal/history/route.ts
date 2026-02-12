import { NextRequest, NextResponse } from "next/server";
import { getPortalSession } from "@/lib/portal/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const session = await getPortalSession();
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const page = Number(searchParams.get("page") || "1");
    const pageSize = Number(searchParams.get("pageSize") || "20");
    const serviceId = searchParams.get("serviceId") || "";
    const dateFrom = searchParams.get("dateFrom") || "";
    const dateTo = searchParams.get("dateTo") || "";

    const supabase = createAdminClient();

    let query = supabase
      .from("point_ledger")
      .select("id, source_type, points_delta, occurs_at, expires_at, services(name)", { count: "exact" })
      .eq("org_id", session.orgId)
      .eq("customer_id", session.customerId)
      .order("occurs_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (serviceId) query = query.eq("service_id", serviceId);
    if (dateFrom) query = query.gte("occurs_at", dateFrom);
    if (dateTo) query = query.lte("occurs_at", dateTo + "T23:59:59");

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: data || [],
      total: count || 0,
      page,
      pageSize,
    });
  } catch (err) {
    console.error("Portal history error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
