"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type B2cOrder = {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  buyer: { phone: string; name: string | null };
  items: Array<{
    quantity: number;
    productDetail: { product: { name: string } };
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
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function AgentOrdersContent() {
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<B2cOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(() => searchParams.get("orderId"));

  useEffect(() => {
    const orderId = searchParams.get("orderId");
    if (!orderId) return;

    const timeoutId = window.setTimeout(() => setExpandedId(orderId), 0);
    return () => window.clearTimeout(timeoutId);
  }, [searchParams]);

  useEffect(() => {
    fetch("/api/b2c/orders")
      .then((res) => res.json())
      .then((data) => {
        setOrders(data.data ?? []);
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-neutral-800">Đơn hàng</h1>
        <span className="text-xs text-neutral-500">{orders.length} đơn</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-neutral-100" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-200 py-12 text-center text-sm text-neutral-500">
          Chưa có đơn hàng nào
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {orders.map((order) => {
            const status = STATUS_MAP[order.status] || { label: order.status, color: "bg-neutral-100 text-neutral-600" };
            const isExpanded = expandedId === order.id;
            const mainItem = order.items[0]?.productDetail?.product?.name;
            const extraCount = order.items.length - 1;

            return (
              <div
                key={order.id}
                className="group rounded-lg border border-neutral-100 bg-white p-3 transition-shadow hover:shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : order.id)}
                    className="mt-0.5 text-neutral-400 transition-colors hover:text-neutral-600"
                  >
                    <svg
                      className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium text-neutral-700">
                        #{order.orderNumber.slice(-6).toUpperCase()}
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
                      <span className="truncate">{order.buyer.name ?? "Nông dân"}</span>
                      <span>·</span>
                      <span className="tabular-nums">{order.buyer.phone}</span>
                    </div>

                    {!isExpanded && (
                      <p className="mt-1 truncate text-xs text-neutral-400">
                        {mainItem}
                        {extraCount > 0 && <span className="text-neutral-500"> +{extraCount}</span>}
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="text-[10px] text-neutral-400">
                      {formatDate(order.createdAt)}
                    </p>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3 border-t border-neutral-100 pt-3">
                    <div className="mb-3 space-y-1">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-xs">
                          <span className="text-neutral-600">{item.productDetail?.product?.name}</span>
                          <span className="tabular-nums text-neutral-500">x{item.quantity}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[10px] text-neutral-400">
                        {formatDate(order.createdAt)} {formatTime(order.createdAt)}
                      </div>
                      <select
                        className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs outline-none focus:border-green-500"
                        value={order.status}
                        onChange={(e) => updateStatus(order.id, e.target.value)}
                      >
                        {Object.entries(STATUS_MAP).map(([value, { label }]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
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

export default function AgentOrdersPage() {
  return (
    <Suspense fallback={<div className="h-16 animate-pulse rounded-lg bg-neutral-100" />}>
      <AgentOrdersContent />
    </Suspense>
  );
}
