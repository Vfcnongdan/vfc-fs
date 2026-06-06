"use client";

import { useEffect, useState } from "react";

type B2cOrder = {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: string;
  createdAt: string;
  buyer: { phone: string; name: string | null };
  items: Array<{
    quantity: number;
    productDetail: { product: { name: string } };
  }>;
};

const STATUS_MAP: Record<string, string> = {
  PENDING: "Chờ duyệt",
  CONFIRMED: "Đã xác nhận",
  SHIPPING: "Đang giao",
  DELIVERED: "Hoàn tất",
  CANCELLED: "Đã hủy",
};

export default function AgentOrdersPage() {
  const [orders, setOrders] = useState<B2cOrder[]>([]);
  const [loading, setLoading] = useState(true);

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
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-neutral-800">📦 Đơn hàng từ nông dân</h1>

      {loading ? (
        <div className="card h-32 animate-pulse bg-neutral-100" />
      ) : orders.length === 0 ? (
        <div className="card text-center py-10 text-neutral-500 text-sm">
          Chưa có đơn hàng nào
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map((order) => (
            <div key={order.id} className="card">
              <div className="flex flex-wrap justify-between gap-2 border-b pb-3 mb-3">
                <div>
                  <p className="font-bold text-neutral-800">
                    #{order.orderNumber.slice(-8).toUpperCase()}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {order.buyer.name ?? "Nông dân"} · {order.buyer.phone}
                  </p>
                  <p className="text-[10px] text-neutral-400 mt-0.5">
                    {new Date(order.createdAt).toLocaleString("vi-VN")}
                  </p>
                </div>
                <p className="font-bold text-green-700">
                  {Number(order.totalAmount).toLocaleString()}đ
                </p>
              </div>
              <p className="text-sm text-neutral-700 mb-3">
                {order.items[0]?.productDetail?.product?.name}
                {order.items.length > 1 && ` +${order.items.length - 1} sản phẩm`}
              </p>
              <select
                className="w-full rounded-lg border border-neutral-200 text-sm"
                value={order.status}
                onChange={(e) => updateStatus(order.id, e.target.value)}
              >
                {Object.entries(STATUS_MAP).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
