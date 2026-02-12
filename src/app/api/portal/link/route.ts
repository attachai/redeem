import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyLineIdToken } from "@/lib/line/verifyIdToken";
import { createPortalSession } from "@/lib/portal/session";
import { portalLinkSchema } from "@/lib/validators/schemas";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = portalLinkSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { id_token, phone, birth_date } = parsed.data;
    const orgId = process.env.PORTAL_ORG_ID;
    if (!orgId) {
      return NextResponse.json({ error: "PORTAL_ORG_ID not configured" }, { status: 500 });
    }

    // Verify LINE id_token
    let lineProfile;
    try {
      lineProfile = await verifyLineIdToken(id_token);
    } catch (err) {
      return NextResponse.json(
        { error: "LINE_VERIFY_FAILED", message: String(err) },
        { status: 401 }
      );
    }

    const lineId = lineProfile.sub;

    // Call RPC to link
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("rpc_link_line_to_customer", {
      p_org_id: orgId,
      p_line_id: lineId,
      p_phone: phone,
      p_birth_date: birth_date,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = data as { success: boolean; error?: string; customer_id?: string; full_name?: string };

    if (!result.success) {
      const statusMap: Record<string, string> = {
        CUSTOMER_NOT_FOUND: "ไม่พบข้อมูลลูกค้า กรุณาตรวจสอบเบอร์โทรและวันเกิด",
        LINE_ID_MISMATCH: "บัญชี LINE นี้ไม่ตรงกับข้อมูลในระบบ กรุณาติดต่อผู้ดูแล",
      };
      return NextResponse.json(
        { error: result.error, message: statusMap[result.error || ""] || "เกิดข้อผิดพลาด" },
        { status: 400 }
      );
    }

    // Create portal session
    await createPortalSession({
      orgId,
      customerId: result.customer_id!,
      lineId,
      customerName: result.full_name || "",
    });

    return NextResponse.json({
      success: true,
      customer_name: result.full_name,
    });
  } catch (err) {
    console.error("Portal link error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
