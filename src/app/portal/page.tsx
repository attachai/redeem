"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Star, Clock, History, Loader2 } from "lucide-react";
import Link from "next/link";

interface Summary {
  customer_name: string;
  available_points: number;
  expiring_3m_points: number;
}

export default function PortalHomePage() {
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await fetch("/api/portal/summary");
        if (res.status === 401) {
          router.push("/portal/link");
          return;
        }
        if (!res.ok) throw new Error("Failed to load summary");
        const data = await res.json();
        setSummary(data);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, [router]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
        <p className="mt-3 text-sm text-gray-500">กำลังโหลด...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-sm rounded-2xl border bg-white p-6 text-center shadow-sm">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="mx-auto max-w-sm space-y-4">
      {/* Welcome */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <p className="text-sm text-gray-500">สวัสดี</p>
        <p className="text-lg font-bold text-gray-900">{summary.customer_name}</p>
      </div>

      {/* Available points */}
      <div className="rounded-2xl border bg-gradient-to-br from-green-500 to-emerald-600 p-6 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <Star className="h-8 w-8" />
          <div>
            <p className="text-sm opacity-80">แต้มคงเหลือ</p>
            <p className="text-3xl font-bold">{summary.available_points.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Expiring points */}
      {summary.expiring_3m_points > 0 && (
        <div className="rounded-2xl border bg-amber-50 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <Clock className="h-6 w-6 text-amber-600" />
            <div>
              <p className="text-sm text-amber-700">แต้มใกล้หมดอายุ (3 เดือน)</p>
              <p className="text-xl font-bold text-amber-700">
                {summary.expiring_3m_points.toLocaleString()} แต้ม
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick links */}
      <Link
        href="/portal/history"
        className="flex items-center gap-3 rounded-2xl border bg-white p-4 shadow-sm hover:bg-gray-50"
      >
        <div className="rounded-xl bg-blue-50 p-2.5">
          <History className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <p className="font-medium text-gray-900">ดูประวัติแต้ม</p>
          <p className="text-xs text-gray-500">ตรวจสอบรายการรับ/ใช้แต้มทั้งหมด</p>
        </div>
      </Link>
    </div>
  );
}
