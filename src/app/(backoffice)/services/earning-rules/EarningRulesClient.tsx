"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { DataTable, type Column } from "@/components/data-table/DataTable";
import { FilterBar } from "@/components/data-table/FilterBar";
import { Plus } from "lucide-react";

interface EarningRule {
  id: string;
  service_id: string;
  spend_amount: number;
  earn_points: number;
  rounding: string;
  min_spend: number | null;
  valid_from: string;
  valid_to: string | null;
  services?: { name: string };
}

export function EarningRulesClient({
  orgId,
  services,
}: {
  orgId: string;
  services: { id: string; name: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const page = Number(searchParams.get("page") || "1");
  const serviceId = searchParams.get("serviceId") || "";

  const [data, setData] = useState<EarningRule[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const pageSize = 20;

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([k, v]) => {
        if (v) params.set(k, v);
        else params.delete(k);
      });
      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    let query = supabase
      .from("earning_rules")
      .select("*, services(name)", { count: "exact" })
      .eq("org_id", orgId)
      .order("valid_from", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (serviceId) query = query.eq("service_id", serviceId);

    const { data: rows, count } = await query;
    setData(rows || []);
    setTotal(count || 0);
    setLoading(false);
  }, [orgId, page, serviceId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns: Column<EarningRule>[] = [
    { key: "service", label: "บริการ", render: (r) => r.services?.name || "-" },
    { key: "spend_amount", label: "ยอดจ่าย (บาท)", render: (r) => r.spend_amount.toLocaleString() },
    { key: "earn_points", label: "ได้แต้ม", render: (r) => r.earn_points.toLocaleString() },
    { key: "rounding", label: "ปัดเศษ" },
    { key: "valid_from", label: "เริ่มต้น" },
    { key: "valid_to", label: "สิ้นสุด", render: (r) => r.valid_to || "ไม่กำหนด" },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">กติกาการได้แต้ม</h2>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          เพิ่มกติกา
        </button>
      </div>

      <div className="mb-4">
        <FilterBar
          serviceId={serviceId}
          services={services}
          onServiceChange={(val) => updateParams({ serviceId: val, page: "1" })}
          onReset={() => router.push("/services/earning-rules")}
        />
      </div>

      <DataTable
        columns={columns}
        data={data}
        totalCount={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        onPageChange={(p) => updateParams({ page: String(p) })}
        rowKey={(r) => r.id}
      />

      {showForm && (
        <RuleFormModal
          orgId={orgId}
          services={services}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchData(); }}
        />
      )}
    </div>
  );
}

function RuleFormModal({
  orgId,
  services,
  onClose,
  onSaved,
}: {
  orgId: string;
  services: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [serviceId, setServiceId] = useState(services[0]?.id || "");
  const [spendAmount, setSpendAmount] = useState("");
  const [earnPoints, setEarnPoints] = useState("");
  const [rounding, setRounding] = useState("FLOOR");
  const [minSpend, setMinSpend] = useState("");
  const [validFrom, setValidFrom] = useState(new Date().toISOString().split("T")[0]);
  const [validTo, setValidTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!serviceId || !spendAmount || !earnPoints || !validFrom) {
      setError("กรุณากรอกข้อมูลให้ครบ");
      return;
    }
    setSaving(true);
    setError("");

    const supabase = createClient();
    const { error: err } = await supabase.from("earning_rules").insert({
      org_id: orgId,
      service_id: serviceId,
      spend_amount: Number(spendAmount),
      earn_points: Number(earnPoints),
      rounding,
      min_spend: minSpend ? Number(minSpend) : null,
      valid_from: validFrom,
      valid_to: validTo || null,
    });

    if (err) { setError(err.message); setSaving(false); return; }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-bold">เพิ่มกติกาการได้แต้ม</h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">บริการ</label>
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400">
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">ยอดจ่าย (บาท)</label>
              <input type="number" value={spendAmount} onChange={(e) => setSpendAmount(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="100" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">ได้แต้ม</label>
              <input type="number" value={earnPoints} onChange={(e) => setEarnPoints(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">ปัดเศษ</label>
              <select value={rounding} onChange={(e) => setRounding(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400">
                <option value="FLOOR">FLOOR (ปัดลง)</option>
                <option value="ROUND">ROUND (ปัดปกติ)</option>
                <option value="CEIL">CEIL (ปัดขึ้น)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">ขั้นต่ำ</label>
              <input type="number" value={minSpend} onChange={(e) => setMinSpend(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="ไม่บังคับ" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">วันเริ่มต้น</label>
              <input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">วันสิ้นสุด</label>
              <input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
          </div>
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose}
            className="rounded-xl border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">ยกเลิก</button>
          <button onClick={handleSave} disabled={saving}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}
