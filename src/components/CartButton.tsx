"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCartStore } from "@/store/useCartStore";

export function CartButton({ dark = false }: { dark?: boolean }) {
  const { init, total } = useCartStore();
  const count = total();

  // Init store with current user once on mount
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user?.id) init(d.user.id);
      })
      .catch(() => {});
  }, [init]);

  return (
    <Link
      href="/farmer/cart"
      aria-label="Giỏ hàng"
      className={`relative inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
        dark
          ? "border-white/20 bg-white/10 text-white hover:bg-white/15"
          : "border-neutral-200 bg-white text-neutral-700 shadow-sm hover:bg-neutral-50"
      }`}
    >
      <ShoppingCart size={16} />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-emerald-500 px-1 py-0.5 text-center text-[9px] font-bold leading-none text-white ring-2 ring-emerald-500">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
