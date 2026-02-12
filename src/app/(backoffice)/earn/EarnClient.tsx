"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/browser";
import { calculatePoints } from "@/lib/points/calc";
import { PlusCircle, Search, CheckCircle } from "lucide-react";

interface Service {
  id: string;
  name: string;
  category: string;
}

interface CustomerResult {
  id: string;
  customer_code: string;
  full_name: string;
  phone: string;
}

export function EarnClient({
  orgId,
  userId,
  services,
}: {
  orgId: string;
  userId: string;
  services: Service[];
}) {
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<CustomerResult[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(null);
  const [serviceId, setServiceId] = useState(services[0]?.id || "");
  const [spendAmount, setSpendAmount] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<{ points: number; expiresAt: string } | null>(null);
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

  const loadPreview = useCallback(async () => {
    if (!serviceId || !spendAmount || Number(spendAmount) <= 0) {
      setPreview(null);
      return;
    }
    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];
    const { data: rule } = await supabase
      .from("earning_rules")
      .select("*")
      .eq("org_id", orgId)
      .eq("service_id", serviceId)
      .lte("valid_from", today)
      .or(`valid_to.is.null,valid_to.gte.${today}`)
      .order("valid_from", { ascending: false })
      .limit(1)
      .single();

    if (rule) {
      const points = calculatePoints(
        Number(spendAmount),
        rule.spend_amount,
        rule.earn_points,
        rule.rounding
      );
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 365);
      setPreview({ points, expiresAt: expiresAt.toLocaleDateString("th-TH") });
    } else {
      setPreview(null);
      setError("ไม่พบกติกาที่ใช้งานได้สำหรับบริการนี้");
    }
  }, [orgId, serviceId, spendAmount]);

  const handleSubmit = async () => {
    if (!selectedCustomer || !serviceId || !spendAmount) {
      setError("กรุณากรอกข้อมูลให้ครบ");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess(null);

    const supabase = createClient();
    const { data, error: err } = await supabase.rpc("rpc_create_transaction_earn", {
      p_org_id: orgId,
      p_customer_id: selectedCustomer.id,
      p_service_id: serviceId,
      p_spend_amount: Number(spendAmount),
      p_tx_datetime: new Date().toISOString(),
      p_reference_no: referenceNo || null,
      p_note: note || null,
      p_created_by: userId,
    });

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    const result = data as { success: boolean; error?: string; points_earned?: number };
    if (!result.success) {
      setError(result.error || "เกิดข้อผิดพลาด");
      setSaving(false);
      return;
    }

    setSuccess(`บันทึกสำเร็จ! ลูกค้าได้รับ ${result.points_earned} แต้ม`);
    setSpendAmount("");
    setReferenceNo("");
    setNote("");
    setPreview(null);
    setSaving(false);
  };

  return (
    <div>
      <h2 className="mb-6 text-xl font-bold text-gray-900">บันทึกแต้ม (Earn)</h2>

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
                onClick={() => setSelectedCustomer(null)}
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
                      onClick={() => { setSelectedCustomer(c); setCustomers([]); setCustomerSearch(""); }}
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

        {/* Service */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">บริการ</label>
          <select
            value={serviceId}
            onChange={(e) => { setServiceId(e.target.value); setPreview(null); }}
            className="w-full rounded-xl border px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.category})</option>
            ))}
          </select>
        </div>

        {/* Spend amount */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">ยอดใช้จ่าย (บาท)</label>
          <input
            type="number"
            value={spendAmount}
            onChange={(e) => { setSpendAmount(e.target.value); setPreview(null); }}
            onBlur={loadPreview}
            placeholder="0.00"
            className="w-full rounded-xl border px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>

        {/* Preview */}
        {preview && (
          <div className="mb-4 rounded-xl bg-green-50 p-4">
            <p className="text-sm text-green-700">
              จะได้รับ <span className="text-lg font-bold">{preview.points}</span> แต้ม
            </p>
            <p className="text-xs text-green-600">หมดอายุ: {preview.expiresAt}</p>
          </div>
        )}

        {/* Reference & Note */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">เลขอ้างอิง</label>
            <input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)}
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
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <PlusCircle className="h-4 w-4" />
          {saving ? "กำลังบันทึก..." : "บันทึกแต้ม"}
        </button>
      </div>
    </div>
  );
}
