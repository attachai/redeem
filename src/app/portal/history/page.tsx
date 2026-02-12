"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

interface LedgerRow {
  id: string;
  source_type: string;
  points_delta: number;
  occurs_at: string;
  expires_at: string | null;
  services?: { name: string } | null;
}

export default function PortalHistoryPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-green-600" /></div>}>
      <PortalHistoryContent />
    </Suspense>
  );
}

function PortalHistoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const page = Number(searchParams.get("page") || "1");
  const dateFrom = searchParams.get("dateFrom") || "";
  const dateTo = searchParams.get("dateTo") || "";
  const serviceId = searchParams.get("serviceId") || "";

  const [data, setData] = useState<LedgerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
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

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (serviceId) params.set("serviceId", serviceId);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/portal/history?${params.toString()}`);
      if (res.status === 401) {
        router.push("/portal/link");
        return;
      }
      const json = await res.json();
      setData(json.data || []);
      setTotal(json.total || 0);
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  }, [page, serviceId, dateFrom, dateTo, router]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const sourceColors: Record<string, string> = {
    EARN: "bg-green-100 text-green-700",
    REDEEM: "bg-red-100 text-red-700",
    EXPIRE: "bg-gray-100 text-gray-600",
    ADJUST: "bg-blue-100 text-blue-700",
    REVERSAL: "bg-amber-100 text-amber-700",
  };

  return (
    <div className="mx-auto max-w-sm">
      <Link href="/portal" className="mb-4 inline-flex items-center gap-1 text-sm text-green-600 hover:underline">
        <ArrowLeft className="h-4 w-4" />
        กลับหน้าหลัก
      </Link>

      <h2 className="mb-4 text-lg font-bold text-gray-900">ประวัติแต้ม</h2>

      {/* Filters */}
      <div className="mb-4 flex gap-2">
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => updateParams({ dateFrom: e.target.value, page: "1" })}
          className="flex-1 rounded-xl border px-3 py-2 text-sm focus:border-green-400 focus:outline-none focus:ring-1 focus:ring-green-400"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => updateParams({ dateTo: e.target.value, page: "1" })}
          className="flex-1 rounded-xl border px-3 py-2 text-sm focus:border-green-400 focus:outline-none focus:ring-1 focus:ring-green-400"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex flex-col items-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-green-600" />
          <p className="mt-2 text-sm text-gray-400">กำลังโหลด...</p>
        </div>
      ) : data.length === 0 ? (
        <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-gray-400">ไม่พบรายการ</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((row) => (
            <div key={row.id} className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${sourceColors[row.source_type] || ""}`}>
                    {row.source_type}
                  </span>
                  <p className="mt-1 text-xs text-gray-400">
                    {new Date(row.occurs_at).toLocaleDateString("th-TH", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                  {row.services?.name && (
                    <p className="text-xs text-gray-500">{row.services.name}</p>
                  )}
                </div>
                <span className={`text-lg font-bold ${row.points_delta > 0 ? "text-green-600" : "text-red-600"}`}>
                  {row.points_delta > 0 ? "+" : ""}{row.points_delta.toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > pageSize && (
        <div className="mt-4 flex items-center justify-center gap-4 text-sm text-gray-500">
          <button
            onClick={() => updateParams({ page: String(page - 1) })}
            disabled={page <= 1}
            className="rounded-lg p-1.5 hover:bg-gray-100 disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span>หน้า {page} / {totalPages}</span>
          <button
            onClick={() => updateParams({ page: String(page + 1) })}
            disabled={page >= totalPages}
            className="rounded-lg p-1.5 hover:bg-gray-100 disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
