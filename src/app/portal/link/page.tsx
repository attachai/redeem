"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Link2, Loader2 } from "lucide-react";

declare global {
  interface Window {
    liff: {
      init: (config: { liffId: string }) => Promise<void>;
      isLoggedIn: () => boolean;
      login: () => void;
      getIDToken: () => string | null;
    };
  }
}

export default function PortalLinkPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [liffReady, setLiffReady] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [liffError, setLiffError] = useState("");

  // After LIFF is ready, check if LINE UUID is already linked
  const checkExistingLink = async () => {
    const idToken = window.liff.getIDToken();
    if (!idToken) return false;

    setChecking(true);
    try {
      const res = await fetch("/api/portal/check-line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_token: idToken }),
      });

      if (!res.ok) return false;

      const data = await res.json();
      if (data.linked) {
        // Already linked — session created by API, go to portal home
        router.replace("/portal");
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    const initLiff = async () => {
      try {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
        if (!liffId) {
          setLiffError("LIFF ID not configured");
          return;
        }

        const onLiffReady = async () => {
          if (!window.liff.isLoggedIn()) {
            window.liff.login();
            return;
          }
          // Check if LINE UUID already linked → auto-login
          const alreadyLinked = await checkExistingLink();
          if (!alreadyLinked) {
            setLiffReady(true);
          }
        };

        // Load LIFF SDK
        if (!window.liff) {
          const script = document.createElement("script");
          script.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
          script.onload = async () => {
            await window.liff.init({ liffId });
            await onLiffReady();
          };
          document.head.appendChild(script);
        } else {
          await window.liff.init({ liffId });
          await onLiffReady();
        }
      } catch (err) {
        setLiffError(`LIFF init failed: ${err}`);
      }
    };

    initLiff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !birthDate) {
      setError("กรุณากรอกข้อมูลให้ครบ");
      return;
    }

    setLoading(true);
    setError("");

    const idToken = window.liff.getIDToken();
    if (!idToken) {
      setError("ไม่สามารถรับ ID Token จาก LINE ได้");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/portal/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_token: idToken, phone, birth_date: birthDate }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || data.error || "เกิดข้อผิดพลาด");
        setLoading(false);
        return;
      }

      router.push("/portal");
    } catch {
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
      setLoading(false);
    }
  };

  if (liffError) {
    return (
      <div className="mx-auto max-w-sm rounded-2xl border bg-white p-6 text-center shadow-sm">
        <p className="text-sm text-red-600">{liffError}</p>
      </div>
    );
  }

  if (!liffReady || checking) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
        <p className="mt-3 text-sm text-gray-500">
          {checking ? "กำลังตรวจสอบบัญชี..." : "กำลังเชื่อมต่อ LINE..."}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <Link2 className="h-7 w-7 text-green-600" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">เชื่อมบัญชี LINE</h2>
          <p className="mt-1 text-sm text-gray-500">
            กรุณากรอกเบอร์โทรและวันเกิดที่ลงทะเบียนไว้
          </p>
        </div>

        <form onSubmit={handleLink} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">เบอร์โทรศัพท์</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0812345678"
              className="w-full rounded-xl border px-3 py-2.5 text-sm focus:border-green-400 focus:outline-none focus:ring-1 focus:ring-green-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">วันเกิด</label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full rounded-xl border px-3 py-2.5 text-sm focus:border-green-400 focus:outline-none focus:ring-1 focus:ring-green-400"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                กำลังเชื่อมบัญชี...
              </>
            ) : (
              "เชื่อมบัญชี"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
