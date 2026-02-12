import { createClient } from "@/lib/supabase/server";
import { ReportsClient } from "./ReportsClient";

export default async function ReportsPage() {
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
    .select("id, name")
    .eq("org_id", profile.org_id)
    .order("name");

  return <ReportsClient orgId={profile.org_id} services={services || []} />;
}
