"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { LogoutButton } from "@/components/LogoutButton";
import { NotificationBell } from "@/components/NotificationBell";

const NON_FARMER_ROLES = ["ADMIN", "SALE", "AGENCY", "SUPER_AGENT", "MDO", "SE", "BGD"];

export function FarmerHeader() {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => {
        if (r.status === 401) {
          window.location.href = "/";
        }
        return r.json();
      })
      .then((d) => setRole(d.user?.role ?? "FARMER"))
      .catch(() => {});
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-[#064E3B] border-b border-white/10 shadow-lg">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-2">
        <Link href="/farmer" className="flex items-center gap-2 transition hover:opacity-80">
          <Image src="/assets/images/logo.svg" alt="VFC Logo" width={60} height={28} className="h-7 w-auto" />
        </Link>

        <nav className="flex items-center gap-3">
          <div className="flex items-center gap-1 px-1">
            <Link href="/farmer/diagnose" className="flex flex-col items-center group px-2 py-1 rounded-lg hover:bg-white/10 transition">
              <span className="text-sm">📸</span>
              <span className="text-[9px] font-bold text-white/70 group-hover:text-white uppercase tracking-tighter">Bệnh</span>
            </Link>
            <Link href="/farmer/products" className="flex flex-col items-center group px-2 py-1 rounded-lg hover:bg-white/10 transition">
              <span className="text-sm">💊</span>
              <span className="text-[9px] font-bold text-white/70 group-hover:text-white uppercase tracking-tighter">Thuốc</span>
            </Link>
            <Link href="/farmer/orders" className="flex flex-col items-center group px-2 py-1 rounded-lg hover:bg-white/10 transition">
              <span className="text-sm">🛍️</span>
              <span className="text-[9px] font-bold text-white/70 group-hover:text-white uppercase tracking-tighter">Đơn</span>
            </Link>
          </div>

          <div className="flex items-center gap-2 border-l border-white/20 pl-3">
            <NotificationBell dark />
            {role && NON_FARMER_ROLES.includes(role) && (
              <Link
                href="/admin"
                className="flex items-center gap-1 rounded-full bg-[#FFD680] px-3 py-1 text-[10px] font-black text-[#064E3B] hover:bg-white transition border border-white/20 shadow-sm mr-1"
              >
                ADMIN
              </Link>
            )}
            <LogoutButton />
          </div>
        </nav>
      </div>
    </header>
  );
}
