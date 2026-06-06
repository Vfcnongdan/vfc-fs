"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, FileText, User, ShieldCheck, Sprout } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";

export default function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navItems = [
    { label: "Kho hàng", href: "/agent/inventory", icon: Package },
    { label: "Đơn hàng", href: "/agent/orders", icon: FileText },
    { label: "Cá nhân", href: "/agent/profile", icon: User },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-16 md:pb-0 md:flex-row">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r h-screen sticky top-0">
        <div className="p-4 border-b font-bold text-lg text-emerald-700">Đại Lý</div>
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                  isActive
                    ? "bg-emerald-50 text-emerald-700 font-medium"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        {/* Quick links to other portals */}
        <div className="p-4 border-t space-y-2">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">Chuyển cổng</p>
          <Link
            href="/admin"
            className="flex items-center gap-3 p-3 rounded-xl text-gray-500 hover:bg-blue-50 hover:text-blue-700 transition-colors"
          >
            <ShieldCheck size={20} />
            <span className="text-sm">Admin</span>
          </Link>
          <Link
            href="/farmer"
            className="flex items-center gap-3 p-3 rounded-xl text-gray-500 hover:bg-green-50 hover:text-green-700 transition-colors"
          >
            <Sprout size={20} />
            <span className="text-sm tracking-tight">Quay lại Farmer</span>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-4xl mx-auto p-4 md:p-6 lg:p-8">
        <div className="mb-3 flex justify-end">
          <NotificationBell />
        </div>
        {children}
      </main>

      {/* Bottom Navigation for Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around p-3 z-50 pb-safe">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 ${
                isActive ? "text-emerald-600" : "text-gray-400"
              }`}
            >
              <Icon size={24} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
        <Link
          href="/admin"
          className="flex flex-col items-center gap-1 text-gray-400 hover:text-blue-600 transition-colors"
        >
          <ShieldCheck size={24} />
          <span className="text-[10px] font-medium">Admin</span>
        </Link>
        <Link
          href="/farmer"
          className="flex flex-col items-center gap-1 text-gray-400 hover:text-green-600 transition-colors"
        >
          <Sprout size={24} />
          <span className="text-[10px] font-medium">Farmer</span>
        </Link>
      </nav>
    </div>
  );
}
