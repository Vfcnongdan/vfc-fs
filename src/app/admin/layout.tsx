"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/LogoutButton";
import { NotificationBell } from "@/components/NotificationBell";
import { removeStoredToken } from "@/lib/auth-client";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [zaloAlert, setZaloAlert] = useState<{
    level: "ok" | "warning" | "critical" | "expired" | "unknown";
    daysLeft: number | null;
  } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (res.status === 401) {
          removeStoredToken(); // Xóa token cũ khỏi localStorage trước khi redirect
          window.location.href = "/";
        }
        return res.json();
      })
      .then((data) => setUser(data.user))
      .catch(() => {});
  }, []);

  // Lấy trạng thái Zalo token cho admin — chỉ fetch khi role là ADMIN
  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    fetch("/api/admin/settings/zalo")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.status) {
          setZaloAlert({
            level: data.status.refreshTokenAlertLevel ?? "unknown",
            daysLeft: data.status.refreshTokenDaysLeft ?? null,
          });
        }
      })
      .catch(() => {});
  }, [user]);

  const canSeeOrders = user?.role === "ADMIN" || user?.role === "AGENCY" || user?.role === "SUPER_AGENT" || user?.role === "MDO" || user?.role === "SE" || user?.role === "MDM" || user?.role === "CV_CM" || user?.role === "ASM" || user?.role === "TSM";
  const isAdminOnly = user?.role === "ADMIN";
  const isMdo = user?.role === "MDO" || user?.role === "MDM" || user?.role === "CV_CM";

  const menuItems = [
    { href: "/admin", icon: "📈", label: "Tổng quan", show: true },
    { href: "/admin/crop-change-requests", icon: "🌱", label: "Duyệt cây trồng", show: isMdo },
    { href: "/admin/orders", icon: "🛒", label: "Quản lý đơn hàng", show: canSeeOrders },
    { href: "/admin/settings", icon: "⚙️", label: "Cài đặt", show: isAdminOnly },
  ].filter(item => item.show);

  const adminMiniApps = [
    { href: "/admin/system/users", icon: "👤", label: "Quản lý người dùng", match: ["/admin/system"] },
    { href: "/admin/ai-training", icon: "🧠", label: "AI Training", match: ["/admin/ai-training"] },
    { href: "/admin/products", icon: "📦", label: "Sản phẩm", match: ["/admin/products"] },
    { href: "/admin/members", icon: "👥", label: "Thành viên", match: ["/admin/members"] },
  ];

  const agentMiniApps = [
    { href: "/agent/inventory", icon: "📦", label: "Quản lý hàng hóa", match: ["/agent/inventory"] },
  ];

  const miniApps = user?.role === "ADMIN" 
    ? adminMiniApps 
    : (user?.role === "AGENCY" || user?.role === "SUPER_AGENT") 
      ? agentMiniApps 
      : [];

  const cleanPathname = pathname?.replace(/\/$/, "") || "";

  const isMiniAppActive = (app: { match: string[] }) => {
    return app.match.some(
      (prefix) => cleanPathname === prefix || cleanPathname.startsWith(`${prefix}/`)
    );
  };

  const isInMiniApp = miniApps.some((app) => isMiniAppActive(app));

  const isItemActive = (href: string) => {
    const cleanHref = href.replace(/\/$/, "");

    if (cleanHref === "/admin") {
      const otherItemsActive = menuItems
        .filter((item) => item.href !== "/admin")
        .some((item) => {
          const itemHref = item.href.replace(/\/$/, "");
          return cleanPathname === itemHref || cleanPathname.startsWith(`${itemHref}/`);
        });

      return (cleanPathname === "/admin" || cleanPathname.startsWith("/admin/")) && !otherItemsActive;
    }
    return cleanPathname === cleanHref || cleanPathname.startsWith(`${cleanHref}/`);
  };

  const sidebarContent = (
    <aside className={`flex h-full flex-col bg-vfc-green shadow-2xl transition-all duration-300 ${isSidebarOpen ? "w-64" : "w-0 sm:w-64 overflow-hidden"}`}>
      <div className="flex items-center gap-2 px-6 py-8 min-w-[256px]">
        <Link href="/farmer" className="transition hover:opacity-80">
          <Image src="/assets/images/logo.svg" alt="VFC Logo" width={80} height={40} className="h-8 w-auto" />
        </Link>
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-vfc-gold tracking-[0.2em] leading-none uppercase">Admin</span>
          <span className="text-[8px] font-bold text-white/50 tracking-wider uppercase">Portal</span>
        </div>
      </div>

      <nav className="flex flex-col gap-1.5 px-4 text-sm min-w-[256px]">
        <p className="px-3 mb-2 text-[10px] font-bold text-white/40 uppercase tracking-widest">Main Menu</p>
        {menuItems.map((item) => {
          const isActive = isItemActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsSidebarOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all ${
                isActive
                  ? "bg-white/20 text-white font-bold border border-white/25 shadow-sm"
                  : "text-white/70 hover:bg-white/10 hover:text-white font-medium border border-transparent hover:border-white/5"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span className="tracking-tight">{item.label}</span>
            </Link>
          );
        })}

        <div className="mt-4 pt-4 border-t border-white/10">
          <Link
            href="/farmer"
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-vfc-gold hover:bg-vfc-gold/10 transition-all font-bold border border-vfc-gold/20"
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
            <span className="text-[11px] font-black text-vfc-gold tracking-tight">IT Helpdesk</span>
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
        <header className="flex items-center justify-between bg-vfc-green px-3 py-2 sm:hidden shadow-md gap-2">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="text-white p-1.5 hover:bg-white/10 rounded-lg"
              aria-label="Open sidebar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            {!isInMiniApp && (
              <Image src="/assets/images/logo.svg" alt="VFC Logo" width={60} height={30} className="h-6 w-auto" />
            )}
          </div>

          {isInMiniApp && (
            <div className="flex items-center gap-1 overflow-x-auto py-0.5 flex-1 min-w-0">
              <div className="flex items-center gap-1 p-0.5 bg-black/20 rounded-xl border border-white/10">
                {miniApps.map((app) => {
                  const isActive = isMiniAppActive(app);
                  return (
                    <Link
                      key={app.href}
                      href={app.href}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] whitespace-nowrap transition-all ${
                        isActive
                          ? "bg-white/20 text-white font-bold border border-white/20 shadow-sm"
                          : "text-white/70 hover:text-white hover:bg-white/10 font-medium"
                      }`}
                    >
                      <span className="text-xs">{app.icon}</span>
                      <span>{app.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex-shrink-0 flex items-center gap-2">
            {/* Zalo Token Alert Badge — chỉ ADMIN */}
            {user?.role === "ADMIN" && zaloAlert && zaloAlert.level !== "ok" && (
              <a
                href="/admin/settings"
                title="Xem cài đặt Zalo"
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                  zaloAlert.level === "expired"
                    ? "bg-red-600 text-white border-red-700 animate-pulse"
                    : zaloAlert.level === "critical"
                    ? "bg-red-50 text-red-700 border-red-300 animate-pulse"
                    : "bg-amber-50 text-amber-700 border-amber-300"
                }`}
              >
                <span>{zaloAlert.level === "expired" ? "⛔" : zaloAlert.level === "critical" ? "🔴" : "🟡"}</span>
                <span className="hidden xs:inline">
                  {zaloAlert.level === "expired"
                    ? "Zalo hết hạn!"
                    : zaloAlert.level === "unknown"
                    ? "Zalo: chưa rõ hạn"
                    : `Zalo ${zaloAlert.daysLeft}d`}
                </span>
              </a>
            )}
            <NotificationBell dark />
          </div>
        </header>

        {/* Desktop Header */}
        <div className="hidden items-center justify-between border-b border-neutral-200 bg-white px-6 py-2.5 sm:flex min-h-[57px]">
          {/* Left: Compact Mini Apps when inside a mini app */}
          <div className="flex items-center gap-2 overflow-x-auto">
            {isInMiniApp && (
              <div className="flex items-center gap-1 p-1 bg-neutral-100/80 rounded-2xl border border-neutral-200/70 shadow-inner">
                {miniApps.map((app) => {
                  const isActive = isMiniAppActive(app);
                  return (
                    <Link
                      key={app.href}
                      href={app.href}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs transition-all ${
                        isActive
                          ? "bg-vfc-green text-white shadow-sm ring-1 ring-black/5 font-bold"
                          : "text-neutral-600 hover:text-neutral-900 hover:bg-white/80 font-medium"
                      }`}
                    >
                      <span className="text-sm">{app.icon}</span>
                      <span className="tracking-tight">{app.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Notification Bell + Zalo Badge */}
          <div className="flex items-center gap-3">
            {/* Zalo Token Alert Badge — chỉ ADMIN */}
            {user?.role === "ADMIN" && zaloAlert && zaloAlert.level !== "ok" && (
              <a
                href="/admin/settings"
                title="Xem cài đặt Zalo"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  zaloAlert.level === "expired"
                    ? "bg-red-600 text-white border-red-700 animate-pulse shadow-md"
                    : zaloAlert.level === "critical"
                    ? "bg-red-50 text-red-700 border-red-200 animate-pulse shadow-sm"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}
              >
                <span className="text-sm">
                  {zaloAlert.level === "expired" ? "⛔" : zaloAlert.level === "critical" ? "🔴" : "🟡"}
                </span>
                <span>
                  {zaloAlert.level === "expired"
                    ? "Zalo token hết hạn — Cập nhật ngay!"
                    : zaloAlert.level === "unknown"
                    ? "Zalo token: chưa xác định hạn — Nhập lại token"
                    : zaloAlert.level === "critical"
                    ? `Zalo token hết hạn trong ${zaloAlert.daysLeft} ngày`
                    : `Zalo token còn ${zaloAlert.daysLeft} ngày`}
                </span>
                <span className="opacity-60">↗</span>
              </a>
            )}
            <NotificationBell />
          </div>
        </div>

        <main className="flex-1 p-4 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
