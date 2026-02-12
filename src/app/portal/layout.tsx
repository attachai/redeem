"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Star, History, Clock, User } from "lucide-react";

const navItems = [
  { href: "/portal", label: "แต้มสะสม", icon: Star },
  { href: "/portal/history", label: "ประวัติ", icon: History },
  { href: "/portal/expiring", label: "ใกล้หมดอายุ", icon: Clock },
  { href: "/portal/profile", label: "ข้อมูลของฉัน", icon: User },
];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLinkPage = pathname === "/portal/link";

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white pb-20">
      <header className="border-b bg-white/80 backdrop-blur">
        <div className="container mx-auto flex h-14 items-center px-4">
          <h1 className="text-lg font-bold text-green-700">My Points</h1>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>

      {/* Bottom navigation — hide on link/verify page */}
      {!isLinkPage && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
          <div className="mx-auto flex max-w-sm items-center justify-around py-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs transition-colors ${
                    isActive
                      ? "font-semibold text-green-600"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <item.icon className={`h-5 w-5 ${isActive ? "text-green-600" : ""}`} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
