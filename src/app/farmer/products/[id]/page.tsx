"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  ShoppingCart,
  Plus,
  Minus,
  CheckCircle2,
  Sprout,
  FlaskConical,
  Target,
  FileText,
  PackageCheck,
  Plane,
  Share2,
  Sparkles,
  X,
  ZoomIn,
} from "lucide-react";
import toast from "react-hot-toast";
import { useCartStore } from "@/store/useCartStore";

type ProductDetailData = {
  id: string;
  name: string;
  plantCrops?: string | null;
  type?: string | null;
  ingredients?: string | null;
  targetDiseases?: string | null;
  usageInstruction?: string | null;
  description?: string | null;
};

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
  detail?: ProductDetailData | null;
};

type RelatedProduct = {
  id: string;
  name: string;
  slug: string;
  imageUrls: string[];
  unit: string;
  price?: number | string | null;
  category?: { name: string } | null;
  detail?: { targetDiseases?: string | null; plantCrops?: string | null } | null;
};

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();

  const [product, setProduct] = useState<ProductData | null>(null);
  const [related, setRelated] = useState<RelatedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string>("");
  const [qty, setQty] = useState(1);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  const { items, add } = useCartStore();

  useEffect(() => {
    if (!id) return;
    setLoading(true);

    fetch(`/api/products/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Product not found");
        return res.json();
      })
      .then((resData) => {
        const p = resData.data?.product ?? resData.product;
        const rel = resData.data?.related ?? resData.related ?? [];
        if (p) {
          setProduct(p);
          setSelectedImage(p.imageUrls?.[0] || "");
        }
        setRelated(rel);
      })
      .catch((err) => {
        console.error("Failed to load product", err);
        setProduct(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const cartQty = product ? items.find((i) => i.productId === product.id)?.quantity ?? 0 : 0;
  const cartTotal = items.reduce((s, i) => s + i.quantity, 0);

  function handleAddToCart() {
    if (!product) return;
    add(
      {
        productId: product.id,
        name: product.name,
        imageUrl: product.imageUrls?.[0] ?? "",
        unit: product.unit,
      },
      qty
    );
    toast.success(`Đã thêm ${qty} ${product.unit} ${product.name} vào giỏ`, {
      icon: "🛒",
      duration: 2000,
    });
  }

  function handleShare() {
    if (navigator.share) {
      navigator
        .share({
          title: product?.name || "Chi tiết sản phẩm VFC",
          url: window.location.href,
        })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Đã chép liên kết vào bộ nhớ tạm");
    }
  }

  // Check if drone friendly
  const isDroneFriendly =
    product?.detail?.description?.toLowerCase().includes("drone") ||
    product?.detail?.description?.toLowerCase().includes("máy bay");

  if (loading) {
    return (
      <div className="flex flex-col gap-3 py-2">
        <div className="flex items-center justify-between">
          <div className="h-7 w-20 animate-pulse rounded-xl bg-neutral-200" />
          <div className="h-7 w-7 animate-pulse rounded-full bg-neutral-200" />
        </div>
        <div className="h-48 w-full animate-pulse rounded-2xl bg-neutral-200" />
        <div className="h-20 w-full animate-pulse rounded-2xl bg-neutral-200" />
        <div className="h-32 w-full animate-pulse rounded-2xl bg-neutral-200" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-3 text-4xl">🧪</div>
        <h2 className="text-sm font-bold text-neutral-800">Không tìm thấy sản phẩm</h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          Sản phẩm có thể đã ngừng bán hoặc liên kết không đúng.
        </p>
        <Link
          href="/farmer/products"
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition"
        >
          <ChevronLeft size={15} /> Quay lại danh sách
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 pb-24">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-xs font-bold text-emerald-800 hover:text-emerald-900 transition bg-white border border-neutral-200 px-2.5 py-1 rounded-xl shadow-2xs"
        >
          <ChevronLeft size={15} /> Danh sách
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="flex h-7 w-7 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-600 shadow-2xs hover:bg-neutral-50 transition"
            title="Chia sẻ"
          >
            <Share2 size={14} />
          </button>
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
      </div>

      {/* Main Product Card Header (Title at top, Image left, Price & SKU right) */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white p-3.5 shadow-2xs flex flex-col gap-3">
        {/* 1. Title at Top */}
        <div className="flex items-center justify-between gap-2 border-b border-neutral-100 pb-2">
          <h1 className="text-lg font-black text-neutral-900 leading-tight">
            {product.name}
          </h1>
          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold text-[10px] shrink-0">
            <CheckCircle2 size={11} /> Chính hãng VFC
          </span>
        </div>

        {/* 2. Image (Left) + Price & SKU (Right) */}
        <div className="flex items-center gap-3">
          {/* Image Container (Left) - Clickable to open zoom modal */}
          <div
            onClick={() => setIsImageModalOpen(true)}
            className="group/img relative h-32 w-32 sm:h-36 sm:w-36 shrink-0 cursor-pointer rounded-xl bg-linear-to-b from-neutral-50 to-neutral-100 flex items-center justify-center p-1.5 border border-neutral-100 transition hover:border-emerald-400 hover:shadow-xs"
            title="Nhấn để phóng to hình ảnh"
          >
            {selectedImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selectedImage}
                alt={product.name}
                className="h-full w-full object-contain drop-shadow-2xs transition-all duration-300 group-hover/img:scale-105"
              />
            ) : (
              <div className="flex items-center justify-center text-neutral-400 gap-1">
                <span className="text-3xl">🧪</span>
              </div>
            )}

            {/* Zoom Icon indicator */}
            <div className="absolute top-1 right-1 rounded-md bg-black/40 p-1 text-white opacity-70 group-hover/img:opacity-100 transition">
              <ZoomIn size={12} />
            </div>

            {isDroneFriendly && (
              <div className="absolute bottom-1 right-1 flex items-center gap-0.5 rounded-md bg-sky-600/90 px-1.5 py-0.5 text-[8px] font-bold text-white shadow-2xs">
                <Plane size={9} /> Drone
              </div>
            )}

            {/* Multi-image thumbnail selector */}
            {product.imageUrls.length > 1 && (
              <div className="absolute bottom-1 left-1/2 flex -translate-x-1/2 gap-1 rounded-full bg-black/40 backdrop-blur-xs p-1">
                {product.imageUrls.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedImage(img);
                    }}
                    className={`h-1.5 w-1.5 rounded-full transition-all ${
                      selectedImage === img ? "bg-white scale-125" : "bg-white/50"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Price, Unit, SKU & Badges (Right of Image) */}
          <div className="flex-1 flex flex-col justify-center gap-1.5 min-w-0">
            {/* Category / Type badges */}
            <div className="flex flex-wrap gap-1">
              {product.category && (
                <span className="rounded-md bg-emerald-100/80 px-2 py-0.5 text-[9px] font-extrabold text-emerald-800">
                  {product.category.name}
                </span>
              )}
              {product.detail?.type && (
                <span className="rounded-md bg-amber-100/80 px-2 py-0.5 text-[9px] font-extrabold text-amber-800">
                  {product.detail.type}
                </span>
              )}
            </div>

            {/* Price */}
            <div>
              <span className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider block">
                Giá sản phẩm
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black text-emerald-700 leading-tight">
                  {product.price && Number(product.price) > 0
                    ? `${Number(product.price).toLocaleString("vi-VN")}đ`
                    : "Liên hệ"}
                </span>
                <span className="text-[10px] font-semibold text-neutral-400">
                  /{product.unit}
                </span>
              </div>
            </div>

            {/* SKU */}
            <div className="text-xs text-neutral-600 font-medium">
              Mã SKU: <span className="font-mono font-bold text-neutral-800">{product.sku}</span>
            </div>
          </div>
        </div>
      </div>

      {/* COMPACT TECHNICAL DETAILS CARD (Inline colon layout to save space) */}
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-3.5 shadow-2xs flex flex-col gap-2 text-xs">
        {/* Hoạt chất */}
        {product.detail?.ingredients && (
          <div className="flex items-start gap-1.5">
            <FlaskConical size={14} className="text-blue-600 shrink-0 mt-0.5" />
            <p className="text-neutral-800 leading-snug">
              <strong className="font-extrabold text-neutral-900">Hoạt chất:</strong>{" "}
              <span>{product.detail.ingredients}</span>
            </p>
          </div>
        )}

        {/* Loại thuốc */}
        {product.detail?.type && (
          <div className="flex items-start gap-1.5">
            <PackageCheck size={14} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-neutral-800 leading-snug">
              <strong className="font-extrabold text-neutral-900">Loại sản phẩm:</strong>{" "}
              <span>{product.detail.type}</span>
            </p>
          </div>
        )}

        {/* Cây trồng áp dụng */}
        {product.detail?.plantCrops && (
          <div className="flex items-start gap-1.5">
            <Sprout size={14} className="text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-neutral-800 leading-snug">
              <strong className="font-extrabold text-neutral-900">Cây trồng:</strong>{" "}
              <span>{product.detail.plantCrops}</span>
            </p>
          </div>
        )}

        {/* Đối tượng phòng trừ */}
        {product.detail?.targetDiseases && (
          <div className="flex items-start gap-1.5">
            <Target size={14} className="text-rose-600 shrink-0 mt-0.5" />
            <p className="text-neutral-800 leading-snug">
              <strong className="font-extrabold text-neutral-900">Đối tượng phòng trừ:</strong>{" "}
              <span>{product.detail.targetDiseases}</span>
            </p>
          </div>
        )}
      </div>

      {/* Hướng dẫn sử dụng & Liều lượng (Gọn nhẹ, inline colon title) */}
      {product.detail?.usageInstruction && (
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-3.5 shadow-2xs flex flex-col gap-1.5 text-xs">
          <div className="flex items-center gap-1.5 font-extrabold text-purple-950">
            <FileText size={14} className="text-purple-600 shrink-0" />
            <span>Hướng dẫn sử dụng & Liều lượng:</span>
          </div>
          <div className="rounded-xl bg-purple-50/50 p-2.5 border border-purple-100 text-neutral-800 leading-relaxed space-y-1">
            {product.detail.usageInstruction
              .split("\n")
              .filter(Boolean)
              .map((line, idx) => (
                <p key={idx} className="flex items-start gap-1.5">
                  <span className="text-purple-600 font-bold">•</span>
                  <span>{line}</span>
                </p>
              ))}
          </div>
        </div>
      )}

      {/* Mô tả & Đặc tính (Gọn nhẹ, inline colon title) */}
      {(product.detail?.description || product.description) && (
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-3.5 shadow-2xs flex flex-col gap-1.5 text-xs">
          <div className="flex items-center gap-1.5 font-extrabold text-emerald-950">
            <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
            <span>Mô tả & Đặc tính:</span>
          </div>
          <div className="rounded-xl bg-neutral-50 p-2.5 border border-neutral-100 text-neutral-800 leading-relaxed space-y-1">
            {(product.detail?.description || product.description || "")
              .split("\n")
              .filter(Boolean)
              .map((line, idx) => (
                <p key={idx} className="flex items-start gap-1.5">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span>{line}</span>
                </p>
              ))}
          </div>
        </div>
      )}

      {/* Sản phẩm tương tự (Compact grid) */}
      {related.length > 0 && (
        <div className="mt-1 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-neutral-800 flex items-center gap-1">
              <Sparkles size={13} className="text-amber-500" /> Sản phẩm tương tự
            </h3>
            <Link href="/farmer/products" className="text-[10px] font-bold text-emerald-700 hover:underline">
              Xem tất cả →
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {related.map((rel) => (
              <Link
                key={rel.id}
                href={`/farmer/products/${rel.id}`}
                className="group flex flex-col overflow-hidden rounded-xl border border-neutral-200/80 bg-white p-2 shadow-2xs transition hover:border-emerald-300"
              >
                <div className="h-24 w-full rounded-lg bg-neutral-50 flex items-center justify-center p-1 mb-1">
                  {rel.imageUrls?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={rel.imageUrls[0]}
                      alt={rel.name}
                      className="h-full w-full object-contain group-hover:scale-105 transition duration-200"
                    />
                  ) : (
                    <span className="text-2xl">🧪</span>
                  )}
                </div>
                <h4 className="line-clamp-1 text-[11px] font-bold text-neutral-800 group-hover:text-emerald-700 transition">
                  {rel.name}
                </h4>
                <div className="mt-auto pt-1 flex items-center justify-between">
                  <span className="text-[11px] font-black text-emerald-700">
                    {rel.price && Number(rel.price) > 0 ? `${Number(rel.price).toLocaleString("vi-VN")}đ` : "Chi tiết"}
                  </span>
                  <span className="text-[9px] text-neutral-400">/{rel.unit}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* STICKY BOTTOM ACTION BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-neutral-200 p-2.5 shadow-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2.5">
          {/* Quantity Selector */}
          <div className="flex items-center rounded-xl border border-neutral-300 bg-neutral-50 p-0.5">
            <button
              onClick={() => setQty(Math.max(1, qty - 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-neutral-700 shadow-2xs hover:bg-neutral-100 transition active:scale-90"
            >
              <Minus size={13} />
            </button>
            <span className="w-8 text-center text-xs font-black text-neutral-900">
              {qty}
            </span>
            <button
              onClick={() => setQty(qty + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-neutral-700 shadow-2xs hover:bg-neutral-100 transition active:scale-90"
            >
              <Plus size={13} />
            </button>
          </div>

          {/* Add to Cart Button */}
          <button
            onClick={handleAddToCart}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-700 py-2.5 px-4 text-xs font-extrabold uppercase tracking-wide text-white shadow-md shadow-emerald-800/20 hover:bg-emerald-800 transition active:scale-[0.98]"
          >
            <ShoppingCart size={15} />
            Thêm vào giỏ hàng {cartQty > 0 ? `(${cartQty} đã chọn)` : ""}
          </button>
        </div>
      </div>

      {/* IMAGE MODAL LIGHTBOX WITH KEY SUMMARY */}
      {isImageModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setIsImageModalOpen(false)}
        >
          <div
            className="relative w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setIsImageModalOpen(false)}
              className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition"
            >
              <X size={18} />
            </button>

            {/* Title inside Modal */}
            <div className="pr-8">
              <h3 className="text-base font-black text-neutral-900 leading-tight">
                {product.name}
              </h3>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                SKU: <span className="font-mono font-bold text-neutral-700">{product.sku}</span> · Chính hãng VFC
              </p>
            </div>

            {/* Large Image View */}
            <div className="relative h-64 sm:h-72 w-full rounded-2xl bg-neutral-50 flex items-center justify-center p-3 border border-neutral-100">
              {selectedImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedImage}
                  alt={product.name}
                  className="h-full w-full object-contain drop-shadow-md"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-neutral-400 gap-1">
                  <span className="text-5xl">🧪</span>
                  <span className="text-xs font-semibold">Chưa có hình ảnh</span>
                </div>
              )}
            </div>

            {/* Multi-image Thumbnails inside Modal */}
            {product.imageUrls.length > 1 && (
              <div className="flex justify-center gap-2">
                {product.imageUrls.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(img)}
                    className={`h-12 w-12 rounded-xl border-2 p-1 overflow-hidden transition ${
                      selectedImage === img ? "border-emerald-600 scale-105" : "border-neutral-200 opacity-60"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img} alt="" className="h-full w-full object-contain" />
                  </button>
                ))}
              </div>
            )}

            {/* Key Information Summary */}
            <div className="rounded-2xl bg-neutral-50 p-3.5 border border-neutral-100 flex flex-col gap-2 text-xs">
              {/* Price */}
              <div className="flex items-baseline justify-between border-b border-neutral-200/60 pb-2">
                <span className="text-neutral-500 font-medium">Giá bán:</span>
                <span className="text-lg font-black text-emerald-700">
                  {product.price && Number(product.price) > 0
                    ? `${Number(product.price).toLocaleString("vi-VN")}đ`
                    : "Liên hệ"}{" "}
                  <span className="text-xs font-normal text-neutral-400">/{product.unit}</span>
                </span>
              </div>

              {/* Ingredients */}
              {product.detail?.ingredients && (
                <p className="text-neutral-800 leading-snug">
                  <strong className="font-extrabold text-neutral-900">Hoạt chất:</strong>{" "}
                  <span>{product.detail.ingredients}</span>
                </p>
              )}

              {/* Plant Crops */}
              {product.detail?.plantCrops && (
                <p className="text-neutral-800 leading-snug">
                  <strong className="font-extrabold text-neutral-900">Cây trồng:</strong>{" "}
                  <span>{product.detail.plantCrops}</span>
                </p>
              )}

              {/* Target Diseases */}
              {product.detail?.targetDiseases && (
                <p className="text-neutral-800 leading-snug">
                  <strong className="font-extrabold text-neutral-900">Phòng trừ:</strong>{" "}
                  <span>{product.detail.targetDiseases}</span>
                </p>
              )}
            </div>

            {/* Add to Cart Button inside Modal */}
            <button
              onClick={() => {
                handleAddToCart();
                setIsImageModalOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 py-3 text-xs font-extrabold uppercase tracking-wide text-white shadow-md hover:bg-emerald-800 transition active:scale-[0.98]"
            >
              <ShoppingCart size={15} /> Thêm vào giỏ hàng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
