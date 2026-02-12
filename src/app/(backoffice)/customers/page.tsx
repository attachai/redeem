import { createClient } from "@/lib/supabase/server";
import { CustomersClient } from "./CustomersClient";

export default async function CustomersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!profile) return <p>Profile not found</p>;

  return <CustomersClient orgId={profile.org_id} />;
}
