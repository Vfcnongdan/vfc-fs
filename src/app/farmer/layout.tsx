import Link from "next/link";
import Image from "next/image";
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
      <nav className="sticky bottom-0 border-t border-black/10 bg-vfc-mint sm:hidden">
        <div className="grid grid-cols-3 divide-x divide-black/5 text-center text-xs font-medium text-black/50">
          {[
            { href: "/farmer", icon: "/assets/images/Home.svg", label: "Trang chủ" },
            { href: "/farmer/diagnose", icon: "/assets/images/Camera.svg", label: "Chuẩn đoán" },
            { href: "/farmer/orders", icon: "/assets/images/Bill.svg", label: "Đơn hàng" },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="group flex flex-col items-center gap-0.5 py-2 hover:bg-black/5 transition-colors">
              <Image src={item.icon} alt={item.label} width={24} height={24} className="transition-[filter] group-hover:[filter:invert(22%)_sepia(99%)_saturate(1061%)_hue-rotate(131deg)_brightness(95%)_contrast(104%)]" />
              <span className="text-black/70 group-hover:text-vfc-green transition-colors">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
