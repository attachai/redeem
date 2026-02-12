"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, User, Phone, Calendar, Mail, CreditCard, Link2 } from "lucide-react";
import Link from "next/link";

interface Profile {
  full_name: string;
  customer_code: string;
  phone: string;
  email: string | null;
  birth_date: string;
  line_linked: boolean;
  line_linked_at: string | null;
  member_since: string;
}

export default function PortalProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch("/api/portal/profile");
        if (res.status === 401) {
          router.push("/portal/link");
          return;
        }
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        setProfile(data);
      } catch {
        // handle error
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [router]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
        <p className="mt-3 text-sm text-gray-500">กำลังโหลด...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-sm rounded-2xl border bg-white p-6 text-center shadow-sm">
        <p className="text-sm text-red-600">ไม่สามารถโหลดข้อมูลได้</p>
      </div>
    );
  }

  const infoRows = [
    { icon: User, label: "ชื่อ", value: profile.full_name },
    { icon: CreditCard, label: "รหัสสมาชิก", value: profile.customer_code },
    { icon: Phone, label: "เบอร์โทร", value: profile.phone },
    { icon: Calendar, label: "วันเกิด", value: profile.birth_date ? new Date(profile.birth_date).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" }) : "-" },
    { icon: Mail, label: "อีเมล", value: profile.email || "-" },
    { icon: Link2, label: "LINE เชื่อมแล้ว", value: profile.line_linked ? `เชื่อมเมื่อ ${new Date(profile.line_linked_at!).toLocaleDateString("th-TH")}` : "ยังไม่ได้เชื่อม" },
    { icon: Calendar, label: "สมาชิกตั้งแต่", value: new Date(profile.member_since).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" }) },
  ];

  return (
    <div className="mx-auto max-w-sm">
      <Link href="/portal" className="mb-4 inline-flex items-center gap-1 text-sm text-green-600 hover:underline">
        <ArrowLeft className="h-4 w-4" />
        กลับหน้าหลัก
      </Link>

      <h2 className="mb-4 text-lg font-bold text-gray-900">ข้อมูลของฉัน</h2>

      <div className="rounded-2xl border bg-white shadow-sm">
        {/* Avatar header */}
        <div className="flex flex-col items-center border-b px-6 py-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <User className="h-8 w-8 text-green-600" />
          </div>
          <p className="mt-3 text-lg font-bold text-gray-900">{profile.full_name}</p>
          <p className="text-sm text-gray-500">{profile.customer_code}</p>
        </div>

        {/* Info rows */}
        <div className="divide-y">
          {infoRows.map((row) => (
            <div key={row.label} className="flex items-center gap-3 px-5 py-3.5">
              <row.icon className="h-5 w-5 shrink-0 text-gray-400" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-400">{row.label}</p>
                <p className="truncate text-sm font-medium text-gray-800">{row.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
