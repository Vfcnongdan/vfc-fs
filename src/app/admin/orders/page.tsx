"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ShoppingCart } from "lucide-react";

type B2cOrder = {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  buyer: { phone: string; name: string | null };
  seller: { name: string | null; agency?: { name: string } | null };
  items: Array<{
    quantity: number;
    product: { name: string };
  }>;
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Chờ duyệt", color: "bg-amber-100 text-amber-700 border-amber-200" },
  CONFIRMED: { label: "Đã xác nhận", color: "bg-blue-100 text-blue-700 border-blue-200" },
  SHIPPING: { label: "Đang giao", color: "bg-purple-100 text-purple-700 border-purple-200" },
  DELIVERED: { label: "Hoàn tất", color: "bg-green-100 text-green-700 border-green-200" },
  CANCELLED: { label: "Đã hủy", color: "bg-red-100 text-red-700 border-red-200" },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function AdminOrdersContent() {
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<B2cOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(() => searchParams.get("orderId"));
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const orderId = searchParams.get("orderId");
    if (!orderId) return;

    const timeoutId = window.setTimeout(() => {
      setExpandedId(orderId);
      // Scroll to order after slight delay
      window.setTimeout(() => {
        document.getElementById(`order-${orderId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [searchParams]);

  useEffect(() => {
    Promise.all([
      fetch("/api/b2c/orders").then((res) => res.json()),
      fetch("/api/auth/me").then((res) => res.json()),
    ]).then(([ordersData, userData]) => {
      setOrders(ordersData.data ?? []);
      setUserRole(userData.user?.role ?? null);
      setLoading(false);
    });
  }, []);

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/b2c/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setOrders(orders.map((o) => (o.id === id ? { ...o, status } : o)));
    }
  }

  const canEdit = userRole === "AGENCY" || userRole === "SUPER_AGENT" || userRole === "ADMIN";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <ShoppingCart size={28} className="text-vfc-green" />
            <h1 className="text-2xl font-black text-vfc-green uppercase tracking-tight">Quản lý đơn hàng</h1>
          </div>
          <p className="text-sm text-neutral-500 mt-1">Danh sách đơn hàng B2C từ nông dân</p>
        </div>
        <span className="text-sm font-bold text-neutral-400">{orders.length} đơn</span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-neutral-100" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-neutral-200 py-16 text-center">
          <ShoppingCart size={48} className="mx-auto text-neutral-300 mb-3" />
          <p className="text-sm font-medium text-neutral-500">Chưa có đơn hàng nào</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {orders.map((order) => {
            const status = STATUS_MAP[order.status] || { label: order.status, color: "bg-neutral-100 text-neutral-600" };
            const isExpanded = expandedId === order.id;
            const mainItem = order.items[0]?.product?.name;
            const extraCount = order.items.length - 1;
            const isHighlighted = searchParams.get("orderId") === order.id;

            return (
              <div
                key={order.id}
                id={`order-${order.id}`}
                className={`group rounded-xl border bg-white p-4 transition-all ${
                  isHighlighted
                    ? "border-vfc-green shadow-lg ring-2 ring-vfc-green/20"
                    : "border-neutral-200 hover:shadow-md"
                }`}
              >
                <div className="flex items-start gap-4">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : order.id)}
                    className="mt-1 text-neutral-400 transition-colors hover:text-neutral-600"
                  >
                    <svg
                      className={`h-5 w-5 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-bold text-neutral-800">
                        #{order.orderNumber.slice(-8).toUpperCase()}
                      </span>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase ${status.color}`}>
                        {status.label}
                      </span>
                    </div>

                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase">Nông dân</span>
                        <span className="font-medium text-neutral-700">{order.buyer.name ?? "Chưa đặt tên"}</span>
                        <span className="text-neutral-500">{order.buyer.phone}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase">Đại lý</span>
                        <span className="font-medium text-neutral-700">
                          {order.seller.agency?.name ?? order.seller.name ?? "—"}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase">Thời gian</span>
                        <span className="font-medium text-neutral-700">{formatDate(order.createdAt)}</span>
                        <span className="text-neutral-500">{formatTime(order.createdAt)}</span>
                      </div>
                    </div>

                    {!isExpanded && (
                      <p className="mt-2 truncate text-xs text-neutral-500">
                        <span className="font-medium">{mainItem}</span>
                        {extraCount > 0 && <span className="text-neutral-400"> +{extraCount} sản phẩm</span>}
                      </p>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 border-t border-neutral-100 pt-4">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase mb-3">Chi tiết đơn hàng</p>
                    <div className="mb-4 space-y-2 bg-neutral-50 rounded-lg p-3">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                           <span className="text-neutral-700 font-medium">{item.product?.name}</span>
                          <span className="tabular-nums text-neutral-600 font-bold">×{item.quantity}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <div className="text-xs text-neutral-400">
                        Đặt lúc {formatDate(order.createdAt)} {formatTime(order.createdAt)}
                      </div>
                      {canEdit ? (
                        <select
                          className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium outline-none transition focus:border-vfc-green focus:ring-2 focus:ring-vfc-green/10"
                          value={order.status}
                          onChange={(e) => updateStatus(order.id, e.target.value)}
                        >
                          {Object.entries(STATUS_MAP).map(([value, { label }]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className={`rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase ${status.color}`}>
                          {status.label}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={<div className="h-20 animate-pulse rounded-xl bg-neutral-100" />}>
      <AdminOrdersContent />
    </Suspense>
  );
}
