"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { LogoutButton } from "@/components/LogoutButton";
import { NotificationBell } from "@/components/NotificationBell";
import { CartButton } from "@/components/CartButton";
import { getMe, removeStoredToken } from "@/lib/auth-client";

const NON_FARMER_ROLES = ["ADMIN", "SALE", "AGENCY", "SUPER_AGENT", "MDO", "SE", "BGD", "MDM", "CV_CM", "ASM", "TSM"];

export function FarmerHeader() {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    getMe()
      .then((res) => {
        if (!res.success) {
          removeStoredToken(); // Xóa token cũ khỏi localStorage trước khi redirect
          window.location.href = "/";
          return;
        }
        setRole(res.user?.role ?? "FARMER");
      })
      .catch(() => {});
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-vfc-mint border-b border-black/10 shadow-lg">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-2.5">
        <Link href="/farmer" className="flex items-center gap-2 transition hover:opacity-80">
          <Image src="/assets/images/Logo-full.svg" alt="VFC Logo" width={80} height={36} className="h-9 w-auto" />
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1 sm:gap-2 px-1">
            <Link href="/farmer/diagnose" className="flex flex-col items-center group px-1.5 py-1 rounded-lg hover:bg-black/5 transition">
              <Image src="/assets/images/Camera.svg" alt="Bệnh" width={20} height={20} className="transition-[filter] group-hover:[filter:invert(22%)_sepia(99%)_saturate(1061%)_hue-rotate(131deg)_brightness(95%)_contrast(104%)]" />
              <span className="text-[9px] font-bold text-black/70 group-hover:text-vfc-green uppercase tracking-tighter mt-0.5 transition-colors">Bệnh</span>
            </Link>
            <Link href="/farmer/products" className="hidden md:flex flex-col items-center group px-1.5 py-1 rounded-lg hover:bg-black/5 transition">
              <Image src="/assets/images/Medicine.svg" alt="Sản phẩm" width={20} height={20} className="transition-[filter] group-hover:[filter:invert(22%)_sepia(99%)_saturate(1061%)_hue-rotate(131deg)_brightness(95%)_contrast(104%)]" />
              <span className="text-[9px] font-bold text-black/70 group-hover:text-vfc-green uppercase tracking-tighter mt-0.5 transition-colors">Sản phẩm</span>
            </Link>
            <Link href="/farmer/orders" className="flex flex-col items-center group px-1.5 py-1 rounded-lg hover:bg-black/5 transition">
              <Image src="/assets/images/Bill.svg" alt="Đơn" width={20} height={20} className="transition-[filter] group-hover:[filter:invert(22%)_sepia(99%)_saturate(1061%)_hue-rotate(131deg)_brightness(95%)_contrast(104%)]" />
              <span className="text-[9px] font-bold text-black/70 group-hover:text-vfc-green uppercase tracking-tighter mt-0.5 transition-colors">Đơn</span>
            </Link>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 border-l border-black/20 pl-2 sm:pl-3">
            <CartButton dark />
            <NotificationBell dark />
            {role && NON_FARMER_ROLES.includes(role) && (
              <Link
                href="/admin"
                className="flex items-center gap-1 rounded-full bg-vfc-gold px-2.5 py-1 text-[10px] font-black text-vfc-green hover:bg-white transition border border-black/20 shadow-sm"
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
