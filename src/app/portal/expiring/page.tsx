"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock, Loader2, AlertTriangle } from "lucide-react";
import Link from "next/link";

interface ExpiringLot {
  id: string;
  remaining_points: number;
  earned_at: string;
  expires_at: string;
  service_name: string | null;
}

export default function PortalExpiringPage() {
  const router = useRouter();
  const [lots, setLots] = useState<ExpiringLot[]>([]);
  const [totalExpiring, setTotalExpiring] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchExpiring = async () => {
      try {
        const res = await fetch("/api/portal/expiring");
        if (res.status === 401) {
          router.push("/portal/link");
          return;
        }
        const data = await res.json();
        setLots(data.lots || []);
        setTotalExpiring(data.total_expiring || 0);
      } catch {
        // handle error
      } finally {
        setLoading(false);
      }
    };
    fetchExpiring();
  }, [router]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
        <p className="mt-3 text-sm text-gray-500">กำลังโหลด...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm">
      <Link href="/portal" className="mb-4 inline-flex items-center gap-1 text-sm text-green-600 hover:underline">
        <ArrowLeft className="h-4 w-4" />
        กลับหน้าหลัก
      </Link>

      <h2 className="mb-4 text-lg font-bold text-gray-900">แต้มใกล้หมดอายุ</h2>

      {/* Summary */}
      {totalExpiring > 0 ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-7 w-7 text-amber-600" />
            <div>
              <p className="text-sm text-amber-700">แต้มที่จะหมดอายุใน 3 เดือน</p>
              <p className="text-2xl font-bold text-amber-700">{totalExpiring.toLocaleString()} แต้ม</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-4 rounded-2xl border bg-white p-8 text-center shadow-sm">
          <Clock className="mx-auto mb-2 h-10 w-10 text-green-400" />
          <p className="font-medium text-gray-700">ไม่มีแต้มใกล้หมดอายุ</p>
          <p className="mt-1 text-sm text-gray-400">แต้มของคุณยังมีอายุอีกนาน</p>
        </div>
      )}

      {/* Detail lots */}
      {lots.length > 0 && (
        <div className="space-y-2">
          {lots.map((lot) => {
            const expiresDate = new Date(lot.expires_at);
            const now = new Date();
            const daysLeft = Math.ceil((expiresDate.getTime() - now.getTime()) / 86400000);

            return (
              <div key={lot.id} className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {lot.remaining_points.toLocaleString()} แต้ม
                    </p>
                    {lot.service_name && (
                      <p className="text-xs text-gray-500">{lot.service_name}</p>
                    )}
                    <p className="text-xs text-gray-400">
                      ได้รับเมื่อ {new Date(lot.earned_at).toLocaleDateString("th-TH", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${daysLeft <= 30 ? "text-red-600" : "text-amber-600"}`}>
                      อีก {daysLeft} วัน
                    </p>
                    <p className="text-xs text-gray-400">
                      หมดอายุ {expiresDate.toLocaleDateString("th-TH", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
