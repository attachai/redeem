"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { DataTable, type Column } from "@/components/data-table/DataTable";
import { FilterBar } from "@/components/data-table/FilterBar";
import { TrendingUp, TrendingDown, Download } from "lucide-react";

interface LedgerRow {
  id: string;
  customer_id: string;
  service_id: string | null;
  source_type: string;
  points_delta: number;
  occurs_at: string;
  expires_at: string | null;
  created_by: string;
  meta: Record<string, unknown>;
  customers?: { full_name: string; customer_code: string };
  services?: { name: string } | null;
  profiles?: { display_name: string } | null;
}

export function ReportsClient({
  orgId,
  services,
}: {
  orgId: string;
  services: { id: string; name: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const page = Number(searchParams.get("page") || "1");
  const search = searchParams.get("search") || "";
  const serviceId = searchParams.get("serviceId") || "";
  const dateFrom = searchParams.get("dateFrom") || "";
  const dateTo = searchParams.get("dateTo") || "";
  const sortBy = searchParams.get("sortBy") || "occurs_at";
  const sortDir = (searchParams.get("sortDir") || "desc") as "asc" | "desc";

  const [data, setData] = useState<LedgerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [summaryEarned, setSummaryEarned] = useState(0);
  const [summaryRedeemed, setSummaryRedeemed] = useState(0);
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
      .from("point_ledger")
      .select("*, customers(full_name, customer_code), services(name), profiles!point_ledger_created_by_fkey(display_name)", { count: "exact" })
      .eq("org_id", orgId)
      .order(sortBy, { ascending: sortDir === "asc" })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (serviceId) query = query.eq("service_id", serviceId);
    if (dateFrom) query = query.gte("occurs_at", dateFrom);
    if (dateTo) query = query.lte("occurs_at", dateTo + "T23:59:59");

    const { data: rows, count } = await query;
    setData(rows || []);
    setTotal(count || 0);

    // Summary query (same filters, no pagination)
    let sumQuery = supabase
      .from("point_ledger")
      .select("source_type, points_delta")
      .eq("org_id", orgId);

    if (serviceId) sumQuery = sumQuery.eq("service_id", serviceId);
    if (dateFrom) sumQuery = sumQuery.gte("occurs_at", dateFrom);
    if (dateTo) sumQuery = sumQuery.lte("occurs_at", dateTo + "T23:59:59");

    const { data: sumRows } = await sumQuery;
    let earned = 0, redeemed = 0;
    (sumRows || []).forEach((r) => {
      if (r.source_type === "EARN" || r.source_type === "ADJUST") earned += Math.abs(r.points_delta);
      if (r.source_type === "REDEEM") redeemed += Math.abs(r.points_delta);
    });
    setSummaryEarned(earned);
    setSummaryRedeemed(redeemed);

    setLoading(false);
  }, [orgId, page, serviceId, dateFrom, dateTo, sortBy, sortDir]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExportCSV = () => {
    if (data.length === 0) return;
    const headers = ["วันที่", "ลูกค้า", "รหัส", "ประเภท", "แต้ม", "บริการ", "หมดอายุ", "ผู้บันทึก"];
    const rows = data.map((r) => [
      new Date(r.occurs_at).toLocaleDateString("th-TH"),
      r.customers?.full_name || "",
      r.customers?.customer_code || "",
      r.source_type,
      r.points_delta,
      r.services?.name || "",
      r.expires_at ? new Date(r.expires_at).toLocaleDateString("th-TH") : "",
      r.profiles?.display_name || "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns: Column<LedgerRow>[] = [
    {
      key: "occurs_at",
      label: "วันที่",
      sortable: true,
      render: (r) => new Date(r.occurs_at).toLocaleDateString("th-TH"),
    },
    {
      key: "customer",
      label: "ลูกค้า",
      render: (r) => (
        <span>
          <span className="font-medium">{r.customers?.customer_code}</span>{" "}
          {r.customers?.full_name}
        </span>
      ),
    },
    {
      key: "source_type",
      label: "ประเภท",
      sortable: true,
      render: (r) => {
        const colors: Record<string, string> = {
          EARN: "bg-green-100 text-green-700",
          REDEEM: "bg-red-100 text-red-700",
          EXPIRE: "bg-gray-100 text-gray-600",
          ADJUST: "bg-blue-100 text-blue-700",
          REVERSAL: "bg-amber-100 text-amber-700",
        };
        return (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[r.source_type] || ""}`}>
            {r.source_type}
          </span>
        );
      },
    },
    {
      key: "points_delta",
      label: "แต้ม",
      sortable: true,
      render: (r) => (
        <span className={r.points_delta > 0 ? "font-medium text-green-600" : "font-medium text-red-600"}>
          {r.points_delta > 0 ? "+" : ""}{r.points_delta.toLocaleString()}
        </span>
      ),
    },
    {
      key: "service",
      label: "บริการ",
      render: (r) => r.services?.name || "-",
    },
    {
      key: "expires_at",
      label: "หมดอายุ",
      render: (r) => r.expires_at ? new Date(r.expires_at).toLocaleDateString("th-TH") : "-",
    },
    {
      key: "created_by",
      label: "ผู้บันทึก",
      render: (r) => r.profiles?.display_name || "-",
    },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">รายงาน</h2>
        <button
          onClick={handleExportCSV}
          className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* Summary cards */}
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-green-50 p-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">แต้มที่ได้</p>
              <p className="text-xl font-bold text-green-600">{summaryEarned.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-red-50 p-2">
              <TrendingDown className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">แต้มที่ใช้</p>
              <p className="text-xl font-bold text-red-600">{summaryRedeemed.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-50 p-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">สุทธิ</p>
              <p className="text-xl font-bold text-blue-600">{(summaryEarned - summaryRedeemed).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <FilterBar
          search={search}
          onSearchChange={(val) => updateParams({ search: val, page: "1" })}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={(val) => updateParams({ dateFrom: val, page: "1" })}
          onDateToChange={(val) => updateParams({ dateTo: val, page: "1" })}
          serviceId={serviceId}
          services={services}
          onServiceChange={(val) => updateParams({ serviceId: val, page: "1" })}
          onReset={() => router.push("/reports")}
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
    </div>
  );
}
