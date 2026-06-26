"use client";

import { useEffect, useState, useMemo } from "react";
import { Search, ShoppingCart, Plus, Minus } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useCartStore } from "@/store/useCartStore";

type Product = {
  id: string;
  name: string;
  sku: string;
  imageUrls: string[];
  unit: string;
  price?: number;
  detail?: { id: string; targetDiseases?: string };
  category?: { name: string; slug: string };
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { items, add, setQty } = useCartStore();

  useEffect(() => {
    fetch("/api/products?limit=50")
      .then((r) => r.json())
      .then((d) => {
        setProducts(d.data ?? []);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category?.name.toLowerCase().includes(q) ||
        p.detail?.targetDiseases?.toLowerCase().includes(q),
    );
  }, [products, search]);

  function cartQty(productId: string) {
    return items.find((i) => i.productId === productId)?.quantity ?? 0;
  }

  function handleAdd(p: Product) {
    add(
      {
        productId: p.id,
        name: p.name,
        imageUrl: p.imageUrls[0] ?? "",
        unit: p.unit,
      },
      1,
    );
    toast.success(`Đã thêm ${p.name}`, { duration: 1500 });
  }

  const cartTotal = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-neutral-800">Sản phẩm VFC</h1>
          <p className="text-xs text-neutral-500">{products.length} sản phẩm</p>
        </div>
        {cartTotal > 0 && (
          <Link
            href="/farmer/cart"
            className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
          >
            <ShoppingCart size={13} />
            {cartTotal} sản phẩm
          </Link>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <input
          type="text"
          placeholder="Tìm theo tên, bệnh, loại..."
          className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-52 animate-pulse rounded-2xl bg-neutral-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-neutral-400">
          Không tìm thấy sản phẩm
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.map((p) => {
            const qty = cartQty(p.id);
            return (
              <div
                key={p.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm transition hover:shadow-md"
              >
                {/* Image */}
                <div className="relative aspect-square w-full bg-neutral-50">
                  {p.imageUrls[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.imageUrls[0]}
                      alt={p.name}
                      className="h-full w-full object-contain p-3"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-4xl">🧪</div>
                  )}
                  {p.category && (
                    <span className="absolute left-2 top-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                      {p.category.name}
                    </span>
                  )}
                </div>

                {/* Info + action */}
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <p className="line-clamp-2 text-xs font-bold leading-tight text-neutral-800">
                    {p.name}
                  </p>
                  {p.detail?.targetDiseases && (
                    <p className="line-clamp-1 text-[10px] text-neutral-400">
                      {p.detail.targetDiseases}
                    </p>
                  )}

                  {/* Add / qty control */}
                  {qty === 0 ? (
                    <button
                      onClick={() => handleAdd(p)}
                      className="mt-auto flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white transition hover:bg-emerald-700"
                    >
                      <Plus size={13} />
                      Thêm vào giỏ
                    </button>
                  ) : (
                    <div className="mt-auto flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50">
                      <button
                        onClick={() => setQty(p.id, qty - 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-l-xl text-emerald-700 transition hover:bg-emerald-100"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="text-sm font-black text-emerald-800">
                        {qty}
                      </span>
                      <button
                        onClick={() => setQty(p.id, qty + 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-r-xl text-emerald-700 transition hover:bg-emerald-100"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sticky checkout bar */}
      {cartTotal > 0 && (
        <div className="sticky bottom-16 sm:bottom-4">
          <Link
            href="/farmer/cart"
            className="flex w-full items-center justify-between rounded-2xl bg-emerald-600 px-5 py-3.5 shadow-lg transition hover:bg-emerald-700 active:scale-[0.99]"
          >
            <div className="flex items-center gap-2 text-white">
              <ShoppingCart size={18} />
              <span className="text-sm font-bold">Xem giỏ hàng</span>
            </div>
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-black text-white">
              {cartTotal} SP
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
