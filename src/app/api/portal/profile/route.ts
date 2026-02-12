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
    const { data, error } = await supabase
      .from("customers")
      .select("full_name, customer_code, phone, email, birth_date, line_id, line_linked_at, created_at")
      .eq("id", session.customerId)
      .eq("org_id", session.orgId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "CUSTOMER_NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({
      full_name: data.full_name,
      customer_code: data.customer_code,
      phone: data.phone,
      email: data.email,
      birth_date: data.birth_date,
      line_linked: !!data.line_id,
      line_linked_at: data.line_linked_at,
      member_since: data.created_at,
    });
  } catch (err) {
    console.error("Portal profile error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
