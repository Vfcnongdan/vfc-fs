import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";
import { FarmerHeader } from "@/components/FarmerHeader";
import { ZaloFloatingButton } from "@/components/ZaloFloatingButton";

export default function FarmerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      {/* Top nav */}
      <FarmerHeader />

      {/* Content */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-4 flex flex-col">
        {children}
      </main>

      {/* Zalo Floating Button */}
      <ZaloFloatingButton />

      {/* Bottom nav (mobile) */}
      <nav className="sticky bottom-0 border-t border-white/10 bg-[#064E3B] sm:hidden">
        <div className="grid grid-cols-3 divide-x divide-white/5 text-center text-xs font-medium text-white/50">
          {[
            { href: "/farmer", icon: "🏠", label: "Trang chủ" },
            { href: "/farmer/diagnose", icon: "📸", label: "Chuẩn đoán" },
            { href: "/farmer/orders", icon: "📦", label: "Đơn hàng" },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="flex flex-col items-center gap-0.5 py-2 hover:bg-white/5 transition-colors">
              <span className="text-xl">{item.icon}</span>
              <span className="text-white/70 group-hover:text-white">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
