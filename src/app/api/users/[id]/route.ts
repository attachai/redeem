import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Helper: verify caller is ADMIN
async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "ADMIN") return null;
  return { userId: user.id, orgId: profile.org_id };
}

// PUT /api/users/[id] — update user (Admin only)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await verifyAdmin();
    if (!caller) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const { display_name, role, password } = body;

    const admin = createAdminClient();

    // Update profile
    const updates: Record<string, string> = {};
    if (display_name) updates.display_name = display_name;
    if (role && ["ADMIN", "STAFF"].includes(role)) updates.role = role;

    if (Object.keys(updates).length > 0) {
      const { error } = await admin
        .from("profiles")
        .update(updates)
        .eq("user_id", id)
        .eq("org_id", caller.orgId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    // Update password if provided
    if (password && password.length >= 6) {
      const { error: pwErr } = await admin.auth.admin.updateUserById(id, {
        password,
      });
      if (pwErr) {
        return NextResponse.json({ error: pwErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PUT /api/users/[id] error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

// DELETE /api/users/[id] — delete user (Admin only, cannot delete self)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await verifyAdmin();
    if (!caller) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    const { id } = await params;

    if (id === caller.userId) {
      return NextResponse.json({ error: "ไม่สามารถลบตัวเองได้" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Delete profile first
    const { error: profErr } = await admin
      .from("profiles")
      .delete()
      .eq("user_id", id)
      .eq("org_id", caller.orgId);

    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 500 });
    }

    // Delete auth user
    const { error: authErr } = await admin.auth.admin.deleteUser(id);
    if (authErr) {
      return NextResponse.json({ error: authErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/users/[id] error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
