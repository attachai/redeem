"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/browser";
import { DataTable, type Column } from "@/components/data-table/DataTable";
import { ArrowLeft, Clock, Star, Gift, Unlink } from "lucide-react";
import Link from "next/link";

interface Customer {
  id: string;
  customer_code: string;
  full_name: string;
  phone: string;
  birth_date: string;
  email: string | null;
  line_id: string | null;
  line_linked_at: string | null;
  notes: string | null;
}

interface LedgerRow {
  id: string;
  source_type: string;
  points_delta: number;
  occurs_at: string;
  expires_at: string | null;
  service_id: string | null;
  created_by: string;
  meta: Record<string, unknown>;
  services?: { name: string } | null;
  profiles?: { display_name: string } | null;
}

export function CustomerDetailClient({
  customer: initialCustomer,
  orgId,
}: {
  customer: Customer;
  orgId: string;
}) {
  const [customer, setCustomer] = useState<Customer>(initialCustomer);
  const [availablePoints, setAvailablePoints] = useState(0);
  const [expiringPoints, setExpiringPoints] = useState(0);
  const [resettingLine, setResettingLine] = useState(false);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 20;

  const fetchSummary = useCallback(async () => {
    const supabase = createClient();
    const now = new Date().toISOString();
    const threeMonths = new Date();
    threeMonths.setMonth(threeMonths.getMonth() + 3);

    const { data: lots } = await supabase
      .from("v_earn_remaining")
      .select("remaining, expires_at")
      .eq("org_id", orgId)
      .eq("customer_id", customer.id)
      .gt("remaining", 0)
      .gt("expires_at", now);

    let avail = 0;
    let expiring = 0;
    (lots || []).forEach((lot) => {
      avail += lot.remaining;
      if (new Date(lot.expires_at) <= threeMonths) {
        expiring += lot.remaining;
      }
    });

    setAvailablePoints(avail);
    setExpiringPoints(expiring);
  }, [orgId, customer.id]);

  const fetchLedger = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, count } = await supabase
      .from("point_ledger")
      .select("*, services(name), profiles!point_ledger_created_by_fkey(display_name)", { count: "exact" })
      .eq("org_id", orgId)
      .eq("customer_id", customer.id)
      .order("occurs_at", { ascending: false })
      .range((ledgerPage - 1) * pageSize, ledgerPage * pageSize - 1);

    setLedger(data || []);
    setLedgerTotal(count || 0);
    setLoading(false);
  }, [orgId, customer.id, ledgerPage]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const handleResetLine = async () => {
    if (!confirm("ต้องการยกเลิกการเชื่อม LINE ของลูกค้านี้?\nลูกค้าจะต้องยืนยันตัวตนใหม่เมื่อเข้า Portal")) return;
    setResettingLine(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("customers")
      .update({ line_id: null, line_linked_at: null })
      .eq("id", customer.id);

    if (error) {
      alert("เกิดข้อผิดพลาด: " + error.message);
    } else {
      setCustomer((prev) => ({ ...prev, line_id: null, line_linked_at: null }));
    }
    setResettingLine(false);
  };

  const ledgerColumns: Column<LedgerRow>[] = [
    {
      key: "occurs_at",
      label: "วันที่",
      render: (r) => new Date(r.occurs_at).toLocaleDateString("th-TH"),
    },
    {
      key: "source_type",
      label: "ประเภท",
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
      <Link href="/customers" className="mb-4 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
        <ArrowLeft className="h-4 w-4" />
        กลับไปรายชื่อลูกค้า
      </Link>

      <div className="mb-6 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-xl font-bold text-gray-900">{customer.full_name}</h2>
        <div className="grid gap-2 text-sm text-gray-600 sm:grid-cols-2 lg:grid-cols-3">
          <p><span className="font-medium">รหัส:</span> {customer.customer_code}</p>
          <p><span className="font-medium">โทร:</span> {customer.phone}</p>
          <p><span className="font-medium">วันเกิด:</span> {customer.birth_date}</p>
          <p><span className="font-medium">อีเมล:</span> {customer.email || "-"}</p>
          <div className="flex items-center gap-2">
            <span className="font-medium">LINE:</span>
            {customer.line_id ? (
              <>
                <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">เชื่อมแล้ว</span>
                <button
                  onClick={handleResetLine}
                  disabled={resettingLine}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
                >
                  <Unlink className="h-3 w-3" />
                  {resettingLine ? "กำลังยกเลิก..." : "ยกเลิกเชื่อม"}
                </button>
              </>
            ) : (
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">ยังไม่เชื่อม</span>
            )}
          </div>
          {customer.notes && <p><span className="font-medium">หมายเหตุ:</span> {customer.notes}</p>}
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-green-50 p-2.5">
              <Star className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">แต้มคงเหลือ</p>
              <p className="text-2xl font-bold text-green-600">{availablePoints.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-50 p-2.5">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">แต้มใกล้หมดอายุ (3 เดือน)</p>
              <p className="text-2xl font-bold text-amber-600">{expiringPoints.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-50 p-2.5">
              <Gift className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">รายการทั้งหมด</p>
              <p className="text-2xl font-bold text-blue-600">{ledgerTotal.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      <h3 className="mb-3 text-lg font-bold text-gray-900">ประวัติแต้ม</h3>
      <DataTable
        columns={ledgerColumns}
        data={ledger}
        totalCount={ledgerTotal}
        page={ledgerPage}
        pageSize={pageSize}
        loading={loading}
        onPageChange={setLedgerPage}
        rowKey={(r) => r.id}
      />
    </div>
  );
}
