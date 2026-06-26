"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart, Minus, Plus, Trash2, MapPin, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import { useCartStore } from "@/store/useCartStore";

type Agency = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  distance: number;
};

type UserProfile = {
  id: string;
  phone: string;
  role: string;
  name: string | null;
  area?: number | null;
  ward?: string | null;
  province?: string | null;
};

function distLabel(meters: number) {
  if (meters === 0) return null;
  return meters >= 1000
    ? `${(meters / 1000).toFixed(1)} km`
    : `${Math.round(meters)} m`;
}

export default function CartPage() {
  const router = useRouter();
  const { items, setQty, remove, clear, init } = useCartStore();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loadingAgencies, setLoadingAgencies] = useState(false);
  const [selectedAgencyId, setSelectedAgencyId] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState("");

  // Load user + init cart store
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user) {
          setUserProfile(d.user);
          init(d.user.id);
        }
      })
      .catch(() => {});
  }, [init]);

  const fetchAgencies = useCallback(async (coords?: { lat: number; lon: number }) => {
    setLoadingAgencies(true);
    try {
      const parts: string[] = [];
      if (coords) {
        parts.push(`latitude=${coords.lat}`, `longitude=${coords.lon}`);
      }
      if (userProfile?.ward) {
        parts.push(`ward=${encodeURIComponent(userProfile.ward)}`);
      }
      const qs = parts.length ? `?${parts.join("&")}` : "";
      const res = await fetch(`/api/farmer/agencies${qs}`);
      if (res.ok) {
        const data: Agency[] = await res.json();
        setAgencies(data);
        if (data.length > 0 && !selectedAgencyId) setSelectedAgencyId(data[0].id);
      }
    } catch {
      // ignore
    } finally {
      setLoadingAgencies(false);
    }
  }, [userProfile?.ward, selectedAgencyId]);

  // Load agencies once profile is ready
  useEffect(() => {
    if (!userProfile) return;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchAgencies({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => fetchAgencies(),
        { timeout: 8000 },
      );
    } else {
      fetchAgencies();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.id]);

  async function handleSubmit() {
    if (items.length === 0) return;
    if (!selectedAgencyId) {
      setOrderError("Vui lòng chọn đại lý");
      return;
    }
    setOrderError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/b2c/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agencyId: selectedAgencyId,
          note: note.trim() || undefined,
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg =
          data.error === "INSUFFICIENT_STOCK"
            ? "Đại lý không đủ tồn kho"
            : data.error === "AGENCY_NOT_LINKED_TO_USER"
              ? "Đại lý chưa kích hoạt tài khoản. Vui lòng liên hệ hỗ trợ."
              : data.error ?? "Đặt hàng thất bại";
        throw new Error(msg);
      }
      clear();
      toast.success(`Đặt hàng thành công! Mã đơn #${String(data.orderNumber).slice(-8).toUpperCase()}`);
      router.push("/farmer/orders");
    } catch (e: unknown) {
      setOrderError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-neutral-100 text-4xl">
          🛒
        </div>
        <p className="text-base font-bold text-neutral-700">Giỏ hàng trống</p>
        <p className="text-sm text-neutral-400">Hãy chọn sản phẩm từ danh mục VFC</p>
        <button
          onClick={() => router.push("/farmer/products")}
          className="mt-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700"
        >
          Xem sản phẩm
        </button>
      </div>
    );
  }

  const totalQty = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="flex flex-col gap-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-emerald-600" />
          <h1 className="text-xl font-black text-neutral-800">Giỏ hàng</h1>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
            {totalQty} SP
          </span>
        </div>
        <button
          onClick={() => { clear(); toast.success("Đã xóa giỏ hàng"); }}
          className="text-xs font-medium text-neutral-400 hover:text-red-500 transition"
        >
          Xóa tất cả
        </button>
      </div>

      {/* Cart items */}
      <div className="flex flex-col divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        {items.map((item) => (
          <div key={item.productId} className="flex items-center gap-3 p-3">
            {/* Image */}
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-neutral-100 bg-neutral-50 p-1">
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.imageUrl} alt={item.name} className="h-full w-full object-contain" />
              ) : (
                <div className="flex h-full items-center justify-center text-2xl">🧪</div>
              )}
            </div>

            {/* Name + unit */}
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-xs font-bold leading-tight text-neutral-800">
                {item.name}
              </p>
              <p className="mt-0.5 text-[10px] text-neutral-400">{item.unit}</p>
            </div>

            {/* Qty stepper */}
            <div className="flex items-center gap-1 rounded-xl border border-neutral-200 bg-neutral-50">
              <button
                onClick={() => setQty(item.productId, item.quantity - 1)}
                className="flex h-7 w-7 items-center justify-center rounded-l-xl text-neutral-500 transition hover:bg-neutral-100"
              >
                {item.quantity === 1 ? <Trash2 size={12} className="text-red-400" /> : <Minus size={12} />}
              </button>
              <span className="w-6 text-center text-sm font-black text-neutral-800">
                {item.quantity}
              </span>
              <button
                onClick={() => setQty(item.productId, item.quantity + 1)}
                className="flex h-7 w-7 items-center justify-center rounded-r-xl text-neutral-500 transition hover:bg-neutral-100"
              >
                <Plus size={12} />
              </button>
            </div>

            {/* Remove */}
            <button
              onClick={() => remove(item.productId)}
              className="ml-1 text-neutral-300 transition hover:text-red-400"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      {/* Order form */}
      <div className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-black text-neutral-700 uppercase tracking-wide">Thông tin đặt hàng</p>

        {/* User info */}
        {userProfile && (
          <div className="rounded-xl bg-neutral-50 px-3 py-2.5">
            <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Người đặt</p>
            <p className="mt-0.5 text-sm font-semibold text-neutral-800">
              {userProfile.name || "Chưa cập nhật"} · {userProfile.phone}
            </p>
          </div>
        )}

        {/* Agency select */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-neutral-500">
            <MapPin size={12} />
            Đại lý tiếp nhận
          </label>
          {loadingAgencies ? (
            <div className="flex items-center gap-2 py-2 text-xs text-neutral-400">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
              Đang tìm đại lý gần nhất...
            </div>
          ) : agencies.length === 0 ? (
            <p className="text-xs text-red-500">Không tìm thấy đại lý phù hợp</p>
          ) : (
            <div className="flex flex-col gap-2">
              {agencies.map((a) => {
                const dist = distLabel(a.distance);
                const isSelected = selectedAgencyId === a.id;
                return (
                  <button
                    key={a.id}
                    onClick={() => setSelectedAgencyId(a.id)}
                    className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                      isSelected
                        ? "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-400/40"
                        : "border-neutral-200 bg-white hover:border-neutral-300"
                    }`}
                  >
                    <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${isSelected ? "border-emerald-500 bg-emerald-500" : "border-neutral-300"}`}>
                      {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-neutral-800">{a.name}</p>
                      {a.address && (
                        <p className="mt-0.5 text-xs text-neutral-500 line-clamp-1">{a.address}</p>
                      )}
                    </div>
                    {dist && (
                      <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-500">
                        {dist}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Note */}
        <div>
          <label htmlFor="order-note" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">
            Ghi chú (tùy chọn)
          </label>
          <textarea
            id="order-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ghi chú thêm cho đại lý..."
            className="w-full resize-none rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
          />
        </div>

        {orderError && (
          <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
            {orderError}
          </p>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting || !selectedAgencyId || agencies.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-black text-white shadow-md transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Đang gửi đơn...
            </>
          ) : (
            <>
              Đặt hàng ({totalQty} sản phẩm)
              <ChevronRight size={16} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
