"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { LogoutButton } from "@/components/LogoutButton";
import { NotificationBell } from "@/components/NotificationBell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState<{ role: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (res.status === 401) {
          window.location.href = "/";
        }
        return res.json();
      })
      .then((data) => setUser(data.user))
      .catch(() => {});
  }, []);

  const canSeeOrders = user?.role === "ADMIN" || user?.role === "AGENCY" || user?.role === "SUPER_AGENT" || user?.role === "MDO" || user?.role === "SE";
  const isAdminOnly = user?.role === "ADMIN";
  const isMdo = user?.role === "MDO";

  const menuItems = [
    { href: "/admin", icon: "📈", label: "Tổng quan", show: true },
    { href: "/admin/crop-change-requests", icon: "🌱", label: "Duyệt cây trồng", show: isMdo },
    { href: "/admin/orders", icon: "🛒", label: "Quản lý đơn hàng", show: canSeeOrders },
    { href: "/admin/settings", icon: "⚙️", label: "Cài đặt", show: isAdminOnly },
  ].filter(item => item.show);

  const sidebarContent = (
    <aside className={`flex h-full flex-col bg-[#064E3B] shadow-2xl transition-all duration-300 ${isSidebarOpen ? "w-64" : "w-0 sm:w-64 overflow-hidden"}`}>
      <div className="flex items-center gap-2 px-6 py-8 min-w-[256px]">
        <Link href="/farmer" className="transition hover:opacity-80">
          <Image src="/assets/images/logo.svg" alt="VFC Logo" width={80} height={40} className="h-8 w-auto" />
        </Link>
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-[#FFD680] tracking-[0.2em] leading-none uppercase">Admin</span>
          <span className="text-[8px] font-bold text-white/50 tracking-wider uppercase">Portal</span>
        </div>
      </div>

      <nav className="flex flex-col gap-1.5 px-4 text-sm min-w-[256px]">
        <p className="px-3 mb-2 text-[10px] font-bold text-white/40 uppercase tracking-widest">Main Menu</p>
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setIsSidebarOpen(false)}
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-white/70 hover:bg-white/10 hover:text-white transition-all font-medium border border-transparent hover:border-white/5"
          >
            <span className="text-base">{item.icon}</span>
            <span className="tracking-tight">{item.label}</span>
          </Link>
        ))}

        <div className="mt-4 pt-4 border-t border-white/10">
          <Link
            href="/farmer"
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-[#FFD680] hover:bg-[#FFD680]/10 transition-all font-bold border border-[#FFD680]/20"
          >
            <span className="text-base">🏠</span>
            <span className="tracking-tight">Quay lại Farmer</span>
          </Link>
        </div>
      </nav>

      <div className="mt-auto p-4 border-t border-white/10 bg-black/10 min-w-[256px]">
        <div className="flex items-center justify-between px-2 mb-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-white/40 uppercase">Hỗ trợ</span>
            <span className="text-[11px] font-black text-[#FFD680] tracking-tight">IT Helpdesk</span>
          </div>
          <LogoutButton />
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-neutral-50/50">
      {/* Sidebar for Desktop */}
      <div className="hidden sm:flex">
        {sidebarContent}
      </div>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 sm:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 sm:hidden transition-transform duration-300 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {sidebarContent}
      </div>

      <div className="flex flex-1 flex-col">
        {/* Mobile Header */}
        <header className="flex items-center justify-between bg-[#064E3B] px-4 py-2 sm:hidden shadow-md">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="text-white p-2 hover:bg-white/10 rounded-lg"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>
          <Image src="/assets/images/logo.svg" alt="VFC Logo" width={60} height={30} className="h-6 w-auto" />
          <NotificationBell dark />
        </header>

        <div className="hidden items-center justify-end border-b border-neutral-200 bg-white px-8 py-3 sm:flex">
          <NotificationBell />
        </div>

        <main className="flex-1 p-4 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
