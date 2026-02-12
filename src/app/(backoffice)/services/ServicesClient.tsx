"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { DataTable, type Column } from "@/components/data-table/DataTable";
import { FilterBar } from "@/components/data-table/FilterBar";
import { Plus, Pencil } from "lucide-react";

interface Service {
  id: string;
  name: string;
  category: string;
  is_active: boolean;
  created_at: string;
}

export function ServicesClient({ orgId }: { orgId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const page = Number(searchParams.get("page") || "1");
  const search = searchParams.get("search") || "";
  const sortBy = searchParams.get("sortBy") || "name";
  const sortDir = (searchParams.get("sortDir") || "asc") as "asc" | "desc";

  const [data, setData] = useState<Service[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Service | null>(null);
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
      .from("services")
      .select("*", { count: "exact" })
      .eq("org_id", orgId)
      .order(sortBy, { ascending: sortDir === "asc" })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    const { data: rows, count } = await query;
    setData(rows || []);
    setTotal(count || 0);
    setLoading(false);
  }, [orgId, page, search, sortBy, sortDir]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns: Column<Service>[] = [
    { key: "name", label: "ชื่อบริการ", sortable: true },
    {
      key: "category",
      label: "ประเภท",
      sortable: true,
      render: (row) => (
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
          row.category === "HOTEL" ? "bg-purple-100 text-purple-700" :
          row.category === "RESTAURANT" ? "bg-orange-100 text-orange-700" :
          "bg-emerald-100 text-emerald-700"
        }`}>
          {row.category}
        </span>
      ),
    },
    {
      key: "is_active",
      label: "สถานะ",
      render: (row) => (
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
          row.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
        }`}>
          {row.is_active ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <button
          onClick={(e) => { e.stopPropagation(); setEditItem(row); setShowForm(true); }}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <Pencil className="h-4 w-4" />
        </button>
      ),
      className: "w-12",
    },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">บริการ</h2>
        <button
          onClick={() => { setEditItem(null); setShowForm(true); }}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          เพิ่มบริการ
        </button>
      </div>

      <div className="mb-4">
        <FilterBar
          search={search}
          onSearchChange={(val) => updateParams({ search: val, page: "1" })}
          onReset={() => router.push("/services")}
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
        <ServiceFormModal
          orgId={orgId}
          item={editItem}
          onClose={() => { setShowForm(false); setEditItem(null); }}
          onSaved={() => { setShowForm(false); setEditItem(null); fetchData(); }}
        />
      )}
    </div>
  );
}

function ServiceFormModal({
  orgId,
  item,
  onClose,
  onSaved,
}: {
  orgId: string;
  item: Service | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(item?.name || "");
  const [category, setCategory] = useState(item?.category || "HOTEL");
  const [isActive, setIsActive] = useState(item?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!name.trim()) { setError("ชื่อบริการต้องไม่ว่าง"); return; }
    setSaving(true);
    setError("");

    const supabase = createClient();

    if (item) {
      const { error: err } = await supabase
        .from("services")
        .update({ name, category, is_active: isActive })
        .eq("id", item.id);
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const { error: err } = await supabase
        .from("services")
        .insert({ org_id: orgId, name, category, is_active: isActive });
      if (err) { setError(err.message); setSaving(false); return; }
    }

    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-bold">
          {item ? "แก้ไขบริการ" : "เพิ่มบริการ"}
        </h3>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">ชื่อบริการ</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">ประเภท</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="HOTEL">HOTEL</option>
              <option value="RESTAURANT">RESTAURANT</option>
              <option value="CAFE">CAFE</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <label className="text-sm text-gray-700">Active</label>
          </div>
        </div>

        {error && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}
