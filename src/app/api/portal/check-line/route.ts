import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyLineIdToken } from "@/lib/line/verifyIdToken";
import { createPortalSession } from "@/lib/portal/session";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id_token } = body;

    if (!id_token || typeof id_token !== "string") {
      return NextResponse.json({ error: "MISSING_ID_TOKEN" }, { status: 400 });
    }

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

    // Check if LINE UUID already linked to a customer
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("rpc_check_line_uid", {
      p_org_id: orgId,
      p_line_id: lineId,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = data as { found: boolean; customer_id?: string; full_name?: string; customer_code?: string };

    if (!result.found) {
      // Not linked yet — client should show verification form
      return NextResponse.json({ linked: false });
    }

    // Already linked — auto-create session
    await createPortalSession({
      orgId,
      customerId: result.customer_id!,
      lineId,
      customerName: result.full_name || "",
    });

    return NextResponse.json({
      linked: true,
      customer_name: result.full_name,
    });
  } catch (err) {
    console.error("Portal check-line error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
