"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Star, Clock, History, Loader2, User } from "lucide-react";
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
      <Link
        href="/portal/expiring"
        className={`block rounded-2xl border p-5 shadow-sm ${
          summary.expiring_3m_points > 0 ? "border-amber-200 bg-amber-50" : "bg-white"
        }`}
      >
        <div className="flex items-center gap-3">
          <Clock className={`h-6 w-6 ${summary.expiring_3m_points > 0 ? "text-amber-600" : "text-gray-400"}`} />
          <div>
            <p className={`text-sm ${summary.expiring_3m_points > 0 ? "text-amber-700" : "text-gray-500"}`}>
              แต้มใกล้หมดอายุ (3 เดือน)
            </p>
            <p className={`text-xl font-bold ${summary.expiring_3m_points > 0 ? "text-amber-700" : "text-gray-400"}`}>
              {summary.expiring_3m_points.toLocaleString()} แต้ม
            </p>
          </div>
        </div>
      </Link>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/portal/history"
          className="flex flex-col items-center gap-2 rounded-2xl border bg-white p-4 shadow-sm hover:bg-gray-50"
        >
          <div className="rounded-xl bg-blue-50 p-2.5">
            <History className="h-5 w-5 text-blue-600" />
          </div>
          <p className="text-center text-sm font-medium text-gray-900">ประวัติแต้ม</p>
        </Link>
        <Link
          href="/portal/profile"
          className="flex flex-col items-center gap-2 rounded-2xl border bg-white p-4 shadow-sm hover:bg-gray-50"
        >
          <div className="rounded-xl bg-purple-50 p-2.5">
            <User className="h-5 w-5 text-purple-600" />
          </div>
          <p className="text-center text-sm font-medium text-gray-900">ข้อมูลของฉัน</p>
        </Link>
      </div>
    </div>
  );
}
