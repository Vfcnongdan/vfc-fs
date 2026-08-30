"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { LogoutButton } from "@/components/LogoutButton";
import { NotificationBell } from "@/components/NotificationBell";
import { CartButton } from "@/components/CartButton";
import { getMe } from "@/lib/auth-client";

const NON_FARMER_ROLES = ["ADMIN", "SALE", "AGENCY", "SUPER_AGENT", "MDO", "SE", "BGD", "MDM", "CV_CM", "ASM", "TSM"];

export function FarmerHeader() {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    getMe()
      .then((res) => {
        if (!res.success) {
          window.location.href = "/";
          return;
        }
        setRole(res.user?.role ?? "FARMER");
      })
      .catch(() => {});
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-[#064E3B] border-b border-white/10 shadow-lg">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-2.5">
        <Link href="/farmer" className="flex items-center gap-2 transition hover:opacity-80">
          <Image src="/assets/images/logo.svg" alt="VFC Logo" width={80} height={36} className="h-9 w-auto" />
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1 sm:gap-2 px-1">
            <Link href="/farmer/diagnose" className="flex flex-col items-center group px-1.5 py-1 rounded-lg hover:bg-white/10 transition">
              <span className="text-[13px] sm:text-sm">📸</span>
              <span className="text-[9px] font-bold text-white/70 group-hover:text-white uppercase tracking-tighter mt-0.5">Bệnh</span>
            </Link>
            <Link href="/farmer/products" className="hidden md:flex flex-col items-center group px-1.5 py-1 rounded-lg hover:bg-white/10 transition">
              <span className="text-[13px] sm:text-sm">💊</span>
              <span className="text-[9px] font-bold text-white/70 group-hover:text-white uppercase tracking-tighter mt-0.5">Sản phẩm</span>
            </Link>
            <Link href="/farmer/orders" className="flex flex-col items-center group px-1.5 py-1 rounded-lg hover:bg-white/10 transition">
              <span className="text-[13px] sm:text-sm">🛍️</span>
              <span className="text-[9px] font-bold text-white/70 group-hover:text-white uppercase tracking-tighter mt-0.5">Đơn</span>
            </Link>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 border-l border-white/20 pl-2 sm:pl-3">
            <CartButton dark />
            <NotificationBell dark />
            {role && NON_FARMER_ROLES.includes(role) && (
              <Link
                href="/admin"
                className="flex items-center gap-1 rounded-full bg-[#FFD680] px-2.5 py-1 text-[10px] font-black text-[#064E3B] hover:bg-white transition border border-white/20 shadow-sm"
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
