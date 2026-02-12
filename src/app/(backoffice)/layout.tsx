import { BackofficeLayout } from "@/components/layout/BackofficeLayout";
import { createClient } from "@/lib/supabase/server";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let role = "STAFF";
  let displayName = "";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, display_name")
      .eq("user_id", user.id)
      .single();
    if (profile) {
      role = profile.role;
      displayName = profile.display_name;
    }
  }

  return (
    <BackofficeLayout role={role} displayName={displayName}>
      {children}
    </BackofficeLayout>
  );
}
