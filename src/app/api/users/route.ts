import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/users — list all users (Admin only)
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "ADMIN") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, org_id, role, display_name, created_at")
      .eq("org_id", profile.org_id)
      .order("created_at", { ascending: true });

    // Get email (username) from Supabase Auth admin API
    const admin = createAdminClient();
    const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 });

    const userMap = new Map<string, string>();
    (authData?.users || []).forEach((u) => {
      userMap.set(u.id, u.email || "");
    });

    const result = (profiles || []).map((p) => ({
      ...p,
      email: userMap.get(p.user_id) || "",
      username: (userMap.get(p.user_id) || "").replace("@redeem.local", ""),
    }));

    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("GET /api/users error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

// POST /api/users — create a new user (Admin only)
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "ADMIN") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const body = await req.json();
    const { username, password, display_name, role } = body;

    if (!username || !password || !display_name || !role) {
      return NextResponse.json({ error: "กรุณากรอกข้อมูลให้ครบ" }, { status: 400 });
    }

    if (!["ADMIN", "STAFF"].includes(role)) {
      return NextResponse.json({ error: "Role ไม่ถูกต้อง" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" }, { status: 400 });
    }

    const email = `${username}@redeem.local`;

    const admin = createAdminClient();

    // Create auth user
    const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authErr) {
      if (authErr.message.includes("already")) {
        return NextResponse.json({ error: "ชื่อผู้ใช้นี้มีอยู่แล้ว" }, { status: 409 });
      }
      return NextResponse.json({ error: authErr.message }, { status: 500 });
    }

    // Create profile
    const { error: profileErr } = await admin
      .from("profiles")
      .insert({
        user_id: authUser.user.id,
        org_id: profile.org_id,
        role,
        display_name,
      });

    if (profileErr) {
      // Rollback: delete auth user
      await admin.auth.admin.deleteUser(authUser.user.id);
      return NextResponse.json({ error: profileErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      user_id: authUser.user.id,
      username,
      display_name,
      role,
    });
  } catch (err) {
    console.error("POST /api/users error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
