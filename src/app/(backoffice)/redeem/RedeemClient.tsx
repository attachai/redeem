"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/browser";
import { Gift, Search, CheckCircle } from "lucide-react";

interface CustomerResult {
  id: string;
  customer_code: string;
  full_name: string;
  phone: string;
}

export function RedeemClient({
  orgId,
  userId,
}: {
  orgId: string;
  userId: string;
}) {
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<CustomerResult[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(null);
  const [availablePoints, setAvailablePoints] = useState<number | null>(null);
  const [pointsToRedeem, setPointsToRedeem] = useState("");
  const [rewardName, setRewardName] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<string | null>(null);

  const searchCustomers = useCallback(
    async (query: string) => {
      if (query.length < 2) { setCustomers([]); return; }
      const supabase = createClient();
      const { data } = await supabase
        .from("customers")
        .select("id, customer_code, full_name, phone")
        .eq("org_id", orgId)
        .or(`full_name.ilike.%${query}%,customer_code.ilike.%${query}%,phone.ilike.%${query}%`)
        .limit(10);
      setCustomers(data || []);
    },
    [orgId]
  );

  const loadAvailablePoints = useCallback(
    async (customerId: string) => {
      const supabase = createClient();
      const now = new Date().toISOString();
      const { data: lots } = await supabase
        .from("v_earn_remaining")
        .select("remaining")
        .eq("org_id", orgId)
        .eq("customer_id", customerId)
        .gt("remaining", 0)
        .gt("expires_at", now);

      const total = (lots || []).reduce((s, r) => s + r.remaining, 0);
      setAvailablePoints(total);
    },
    [orgId]
  );

  const handleSelectCustomer = (c: CustomerResult) => {
    setSelectedCustomer(c);
    setCustomers([]);
    setCustomerSearch("");
    loadAvailablePoints(c.id);
  };

  const handleSubmit = async () => {
    if (!selectedCustomer || !pointsToRedeem || Number(pointsToRedeem) <= 0) {
      setError("กรุณากรอกข้อมูลให้ครบ");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess(null);

    const supabase = createClient();
    const { data, error: err } = await supabase.rpc("rpc_redeem_points", {
      p_org_id: orgId,
      p_customer_id: selectedCustomer.id,
      p_points_to_redeem: Number(pointsToRedeem),
      p_redeem_datetime: new Date().toISOString(),
      p_reward_name: rewardName || null,
      p_note: note || null,
      p_created_by: userId,
    });

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    const result = data as { success: boolean; error?: string; available?: number; points_redeemed?: number };
    if (!result.success) {
      const msg = result.error === "INSUFFICIENT_POINTS"
        ? `แต้มไม่เพียงพอ (คงเหลือ ${result.available})`
        : result.error || "เกิดข้อผิดพลาด";
      setError(msg);
      setSaving(false);
      return;
    }

    setSuccess(`แลกแต้มสำเร็จ! ใช้ ${result.points_redeemed} แต้ม`);
    setPointsToRedeem("");
    setRewardName("");
    setNote("");
    loadAvailablePoints(selectedCustomer.id);
    setSaving(false);
  };

  return (
    <div>
      <h2 className="mb-6 text-xl font-bold text-gray-900">แลกแต้ม (Redeem)</h2>

      <div className="mx-auto max-w-lg rounded-2xl border bg-white p-6 shadow-sm">
        {/* Customer search */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">ลูกค้า</label>
          {selectedCustomer ? (
            <div className="flex items-center justify-between rounded-xl border bg-blue-50 px-3 py-2">
              <span className="text-sm font-medium text-blue-700">
                {selectedCustomer.customer_code} — {selectedCustomer.full_name}
              </span>
              <button
                onClick={() => { setSelectedCustomer(null); setAvailablePoints(null); }}
                className="text-xs text-blue-500 hover:underline"
              >
                เปลี่ยน
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={customerSearch}
                onChange={(e) => { setCustomerSearch(e.target.value); searchCustomers(e.target.value); }}
                placeholder="ค้นหาชื่อ / รหัส / โทร..."
                className="w-full rounded-xl border px-3 py-2 pl-9 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              {customers.length > 0 && (
                <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-xl border bg-white shadow-lg">
                  {customers.map((c) => (
                    <li
                      key={c.id}
                      onClick={() => handleSelectCustomer(c)}
                      className="cursor-pointer px-3 py-2 text-sm hover:bg-blue-50"
                    >
                      <span className="font-medium">{c.customer_code}</span> — {c.full_name} ({c.phone})
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Available points */}
        {availablePoints !== null && (
          <div className="mb-4 rounded-xl bg-green-50 p-4">
            <p className="text-sm text-green-700">
              แต้มคงเหลือ: <span className="text-lg font-bold">{availablePoints.toLocaleString()}</span> แต้ม
            </p>
          </div>
        )}

        {/* Points to redeem */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">จำนวนแต้มที่ต้องการใช้</label>
          <input
            type="number"
            value={pointsToRedeem}
            onChange={(e) => setPointsToRedeem(e.target.value)}
            placeholder="0"
            className="w-full rounded-xl border px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>

        {/* Reward & Note */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">ของรางวัล</label>
            <input value={rewardName} onChange={(e) => setRewardName(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              placeholder="ไม่บังคับ" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">หมายเหตุ</label>
            <input value={note} onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              placeholder="ไม่บังคับ" />
          </div>
        </div>

        {error && <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}
        {success && (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-green-50 p-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <p className="text-sm font-medium text-green-700">{success}</p>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={saving || !selectedCustomer}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
        >
          <Gift className="h-4 w-4" />
          {saving ? "กำลังดำเนินการ..." : "แลกแต้ม"}
        </button>
      </div>
    </div>
  );
}
