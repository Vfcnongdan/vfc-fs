"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ShoppingCart, ShieldCheck, XCircle } from "lucide-react";
import { useCartStore } from "@/store/useCartStore";

type ProductData = {
  id: string;
  name: string;
  sku: string;
  slug: string;
  description?: string | null;
  imageUrls: string[];
  price?: number | string | null;
  unit: string;
  stock: number;
  isActive: boolean;
  category?: { id: string; name: string; slug: string } | null;
  detail?: any;
};

type RelatedProduct = {
  id: string;
  name: string;
  slug: string;
  imageUrls: string[];
  unit: string;
  price?: number | string | null;
  category?: { name: string } | null;
};

export default function QRResultPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();

  const [product, setProduct] = useState<ProductData | null>(null);
  const [related, setRelated] = useState<RelatedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const { items } = useCartStore();
  const cartTotal = items.reduce((s, i) => s + i.quantity, 0);

  useEffect(() => {
    if (!id) return;
    setLoading(true);

    fetch(`/api/products/${id}`)
      .then((res) => {
        if (!res.ok) {
          setNotFound(true);
          return null;
        }
        return res.json();
      })
      .then((resData) => {
        if (!resData) return;
        const p = resData.data?.product ?? resData.product;
        const rel = resData.data?.related ?? resData.related ?? [];
        if (p) {
          setProduct(p);
          // Log success
          fetch("/api/qr/log", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId: p.id, code: id, success: true }),
          }).catch(console.error);
        } else {
          setNotFound(true);
        }
        setRelated(rel);
      })
      .catch((err) => {
        console.error("Failed to load product", err);
        setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (notFound) {
      // Log failure
      fetch("/api/qr/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: id, success: false }),
      }).catch(console.error);
    }
  }, [notFound, id]);

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <main className="min-h-screen bg-neutral-50 px-4 py-8 flex flex-col items-center justify-center">
        <div className="text-red-500 mb-4">
          <XCircle size={80} />
        </div>
        <h1 className="text-2xl font-black text-neutral-900 text-center mb-2">
          Mã không hợp lệ
        </h1>
        <p className="text-sm text-neutral-600 text-center mb-8 max-w-sm">
          Rất tiếc, mã QR này không tồn tại trong hệ thống sản phẩm chính hãng của VFC.
        </p>
        <Link
          href="/farmer"
          className="bg-emerald-600 text-white font-bold py-3 px-8 rounded-full shadow-lg"
        >
          Về Trang Chủ
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-6 pb-24">
      {/* Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-emerald-600 to-emerald-800 p-4 shadow-lg mb-4">
        <div className="absolute -right-4 -top-4 opacity-10">
          <ShieldCheck size={96} />
        </div>
        <div className="relative flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm shadow-inner">
            <ShieldCheck size={28} className="text-white drop-shadow-sm" />
          </div>
          <div>
            <h2 className="text-base font-extrabold tracking-tight uppercase text-white">
              ✅ Sản phẩm chính hãng VFC
            </h2>
            <p className="text-xs text-white/80 mt-0.5">
              Mã sản phẩm đã được xác thực thành công.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <Link
          href="/farmer/products"
          className="flex items-center gap-1 text-xs font-bold text-emerald-800 hover:text-emerald-900 transition bg-white border border-neutral-200 px-2.5 py-1 rounded-xl shadow-2xs"
        >
          <ChevronLeft size={15} /> Tất cả sản phẩm
        </Link>
        <Link
          href="/farmer/cart"
          className="relative flex h-7 items-center gap-1.5 rounded-xl bg-emerald-700 px-2.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-800 transition"
        >
          <ShoppingCart size={14} />
          {cartTotal > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-black text-neutral-900">
              {cartTotal}
            </span>
          )}
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white p-3.5 shadow-2xs flex flex-col gap-3">
        <h1 className="text-lg font-black text-neutral-900 leading-tight border-b border-neutral-100 pb-2">
          {product.name}
        </h1>

        <div className="flex items-center gap-3">
          <div className="relative h-32 w-32 sm:h-36 sm:w-36 shrink-0 rounded-xl bg-linear-to-b from-neutral-50 to-neutral-100 flex items-center justify-center p-1.5 border border-neutral-100 overflow-hidden">
            {product.imageUrls?.[0] ? (
              <div className="relative w-full h-full">
                <Image
                  src={product.imageUrls[0]}
                  alt={product.name}
                  fill
                  className="object-contain"
                  sizes="(max-width: 640px) 128px, 144px"
                  priority
                />
              </div>
            ) : (
              <span className="text-3xl">🧪</span>
            )}
          </div>
          <div className="flex-1 flex flex-col justify-center gap-1.5 min-w-0">
            <div className="text-xl font-black text-emerald-700 leading-tight">
              {product.price ? `${Number(product.price).toLocaleString("vi-VN")}đ` : "Liên hệ"}
              <span className="text-[10px] text-neutral-400 ml-1">/{product.unit}</span>
            </div>
            <div className="text-xs text-neutral-600 font-medium">
              SKU: <span className="font-mono font-bold text-neutral-800">{product.sku}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-4">
         <Link
            href={`/farmer/products/${product.id}`}
            className="flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow hover:bg-emerald-700 transition"
          >
            Xem Chi Tiết & Mua Hàng
          </Link>
      </div>
    </main>
  );
}
