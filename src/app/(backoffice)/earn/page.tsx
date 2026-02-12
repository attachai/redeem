import { createClient } from "@/lib/supabase/server";
import { EarnClient } from "./EarnClient";

export default async function EarnPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!profile) return <p>Profile not found</p>;

  const { data: services } = await supabase
    .from("services")
    .select("id, name, category")
    .eq("org_id", profile.org_id)
    .eq("is_active", true)
    .order("name");

  return <EarnClient orgId={profile.org_id} userId={user.id} services={services || []} />;
}
