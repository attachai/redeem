import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPortalSession } from "@/lib/portal/session";

/**
 * Web-direct verification: phone + birth_date (no LINE token required).
 * Creates a portal session without linking LINE UUID.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, birth_date } = body;

    if (!phone || !birth_date) {
      return NextResponse.json({ error: "กรุณากรอกเบอร์โทรและวันเกิด" }, { status: 400 });
    }

    const orgId = process.env.PORTAL_ORG_ID;
    if (!orgId) {
      return NextResponse.json({ error: "PORTAL_ORG_ID not configured" }, { status: 500 });
    }

    // Normalize phone (remove dashes/spaces, convert 0xx to 66xx)
    let normalized = phone.replace(/[\s-]/g, "");
    if (normalized.startsWith("0")) {
      normalized = "66" + normalized.slice(1);
    }

    const supabase = createAdminClient();

    // Find customer by phone_normalized + birth_date
    const { data: customer, error } = await supabase
      .from("customers")
      .select("id, full_name, customer_code")
      .eq("org_id", orgId)
      .eq("phone_normalized", normalized)
      .eq("birth_date", birth_date)
      .single();

    if (error || !customer) {
      return NextResponse.json(
        { error: "CUSTOMER_NOT_FOUND", message: "ไม่พบข้อมูลลูกค้า กรุณาตรวจสอบเบอร์โทรและวันเกิด" },
        { status: 400 }
      );
    }

    // Create portal session (without lineId for web-direct)
    await createPortalSession({
      orgId,
      customerId: customer.id,
      lineId: "",
      customerName: customer.full_name,
    });

    return NextResponse.json({
      success: true,
      customer_name: customer.full_name,
    });
  } catch (err) {
    console.error("Portal verify error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
