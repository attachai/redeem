"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { DataTable, type Column } from "@/components/data-table/DataTable";
import { FilterBar } from "@/components/data-table/FilterBar";
import { Plus, Pencil, Eye } from "lucide-react";
import { normalizeTHPhone } from "@/lib/points/calc";

interface Customer {
  id: string;
  customer_code: string;
  full_name: string;
  phone: string;
  birth_date: string;
  email: string | null;
  line_id: string | null;
  created_at: string;
}

export function CustomersClient({ orgId }: { orgId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const page = Number(searchParams.get("page") || "1");
  const search = searchParams.get("search") || "";
  const sortBy = searchParams.get("sortBy") || "customer_code";
  const sortDir = (searchParams.get("sortDir") || "asc") as "asc" | "desc";

  const [data, setData] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Customer | null>(null);
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
      .from("customers")
      .select("*", { count: "exact" })
      .eq("org_id", orgId)
      .order(sortBy, { ascending: sortDir === "asc" })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,customer_code.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data: rows, count } = await query;
    setData(rows || []);
    setTotal(count || 0);
    setLoading(false);
  }, [orgId, page, search, sortBy, sortDir]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns: Column<Customer>[] = [
    { key: "customer_code", label: "รหัส", sortable: true },
    { key: "full_name", label: "ชื่อ", sortable: true },
    { key: "phone", label: "โทร" },
    { key: "birth_date", label: "วันเกิด" },
    {
      key: "line_id",
      label: "LINE",
      render: (row) => (
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
          row.line_id ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
        }`}>
          {row.line_id ? "เชื่อมแล้ว" : "ยังไม่เชื่อม"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="flex gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); router.push(`/customers/${row.id}`); }}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setEditItem(row); setShowForm(true); }}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      ),
      className: "w-24",
    },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">ลูกค้า</h2>
        <button
          onClick={() => { setEditItem(null); setShowForm(true); }}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          เพิ่มลูกค้า
        </button>
      </div>

      <div className="mb-4">
        <FilterBar
          search={search}
          onSearchChange={(val) => updateParams({ search: val, page: "1" })}
          onReset={() => router.push("/customers")}
        />
      </div>

      <DataTable
        columns={columns}
        data={data}
        totalCount={total}
        page={page}
        pageSize={pageSize}
        sortBy={sortBy}
        sortDir={sortDir}
        loading={loading}
        onPageChange={(p) => updateParams({ page: String(p) })}
        onSortChange={(s, d) => updateParams({ sortBy: s, sortDir: d, page: "1" })}
        rowKey={(r) => r.id}
      />

      {showForm && (
        <CustomerFormModal
          orgId={orgId}
          item={editItem}
          onClose={() => { setShowForm(false); setEditItem(null); }}
          onSaved={() => { setShowForm(false); setEditItem(null); fetchData(); }}
        />
      )}
    </div>
  );
}

function CustomerFormModal({
  orgId,
  item,
  onClose,
  onSaved,
}: {
  orgId: string;
  item: Customer | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [customerCode, setCustomerCode] = useState(item?.customer_code || "");
  const [fullName, setFullName] = useState(item?.full_name || "");
  const [phone, setPhone] = useState(item?.phone || "");
  const [birthDate, setBirthDate] = useState(item?.birth_date || "");
  const [email, setEmail] = useState(item?.email || "");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!customerCode || !fullName || !phone || !birthDate) {
      setError("กรุณากรอกข้อมูลที่จำเป็น");
      return;
    }
    setSaving(true);
    setError("");

    const supabase = createClient();
    const phoneNormalized = normalizeTHPhone(phone);

    if (item) {
      const { error: err } = await supabase
        .from("customers")
        .update({ customer_code: customerCode, full_name: fullName, phone, phone_normalized: phoneNormalized, birth_date: birthDate, email: email || null, notes: notes || null })
        .eq("id", item.id);
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const { error: err } = await supabase
        .from("customers")
        .insert({ org_id: orgId, customer_code: customerCode, full_name: fullName, phone, phone_normalized: phoneNormalized, birth_date: birthDate, email: email || null, notes: notes || null });
      if (err) { setError(err.message); setSaving(false); return; }
    }

    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-bold">{item ? "แก้ไขลูกค้า" : "เพิ่มลูกค้า"}</h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">รหัสลูกค้า</label>
            <input value={customerCode} onChange={(e) => setCustomerCode(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">ชื่อ-นามสกุล</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">เบอร์โทร</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="0812345678" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">วันเกิด</label>
              <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">อีเมล (ไม่บังคับ)</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">หมายเหตุ</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full rounded-xl border px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400" />
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
