import { createClient } from "@/lib/supabase/server";
import { TrendingUp, TrendingDown, Clock, Minus } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, display_name")
    .eq("user_id", user.id)
    .single();

  if (!profile) return <p>Profile not found</p>;

  const orgId = profile.org_id;
  const today = new Date().toISOString().split("T")[0];
  const monthStart = today.slice(0, 7) + "-01";

  // Today stats
  const { data: todayEarned } = await supabase
    .from("point_ledger")
    .select("points_delta")
    .eq("org_id", orgId)
    .eq("source_type", "EARN")
    .gte("occurs_at", today);

  const { data: todayRedeemed } = await supabase
    .from("point_ledger")
    .select("points_delta")
    .eq("org_id", orgId)
    .eq("source_type", "REDEEM")
    .gte("occurs_at", today);

  // Month stats
  const { data: monthEarned } = await supabase
    .from("point_ledger")
    .select("points_delta")
    .eq("org_id", orgId)
    .eq("source_type", "EARN")
    .gte("occurs_at", monthStart);

  const { data: monthRedeemed } = await supabase
    .from("point_ledger")
    .select("points_delta")
    .eq("org_id", orgId)
    .eq("source_type", "REDEEM")
    .gte("occurs_at", monthStart);

  // Expiring in 3 months
  const threeMonthsLater = new Date();
  threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

  const { data: expiringLots } = await supabase
    .from("v_earn_remaining")
    .select("remaining")
    .eq("org_id", orgId)
    .gt("remaining", 0)
    .gt("expires_at", new Date().toISOString())
    .lte("expires_at", threeMonthsLater.toISOString());

  const sumPoints = (rows: { points_delta: number }[] | null) =>
    (rows || []).reduce((s, r) => s + Math.abs(r.points_delta), 0);

  const todayEarnSum = sumPoints(todayEarned);
  const todayRedeemSum = sumPoints(todayRedeemed);
  const monthEarnSum = sumPoints(monthEarned);
  const monthRedeemSum = sumPoints(monthRedeemed);
  const expiringSum = (expiringLots || []).reduce((s, r) => s + r.remaining, 0);

  const cards = [
    { label: "แต้มที่ได้วันนี้", value: todayEarnSum.toLocaleString(), icon: TrendingUp, color: "text-green-600", bg: "bg-green-50" },
    { label: "แต้มที่ใช้วันนี้", value: todayRedeemSum.toLocaleString(), icon: TrendingDown, color: "text-red-600", bg: "bg-red-50" },
    { label: "แต้มที่ได้เดือนนี้", value: monthEarnSum.toLocaleString(), icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "แต้มที่ใช้เดือนนี้", value: monthRedeemSum.toLocaleString(), icon: TrendingDown, color: "text-orange-600", bg: "bg-orange-50" },
    { label: "แต้มใกล้หมดอายุ (3 เดือน)", value: expiringSum.toLocaleString(), icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "สุทธิเดือนนี้", value: (monthEarnSum - monthRedeemSum).toLocaleString(), icon: Minus, color: "text-indigo-600", bg: "bg-indigo-50" },
  ];

  return (
    <div>
      <h2 className="mb-6 text-xl font-bold text-gray-900">
        Dashboard
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-2xl border bg-white p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className={`rounded-xl p-2.5 ${card.bg}`}>
                  <Icon className={`h-5 w-5 ${card.color}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{card.label}</p>
                  <p className={`text-2xl font-bold ${card.color}`}>
                    {card.value}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
