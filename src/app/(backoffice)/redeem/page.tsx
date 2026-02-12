import { createClient } from "@/lib/supabase/server";
import { RedeemClient } from "./RedeemClient";

export default async function RedeemPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!profile) return <p>Profile not found</p>;

  return <RedeemClient orgId={profile.org_id} userId={user.id} />;
}
