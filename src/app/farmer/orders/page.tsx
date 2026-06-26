"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type B2cOrderItem = {
  quantity: number;
  product: { name: string };
};

type B2cOrder = {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  items: B2cOrderItem[];
};

const STATUS_MAP: Record<string, { label: string; class: string }> = {
  PENDING: { label: "Chờ duyệt", class: "bg-amber-100 text-amber-700" },
  CONFIRMED: { label: "Đã xác nhận", class: "bg-blue-100 text-blue-700" },
  SHIPPING: { label: "Đang giao", class: "bg-purple-100 text-purple-700" },
  DELIVERED: { label: "Hoàn tất", class: "bg-green-100 text-green-700" },
  CANCELLED: { label: "Đã hủy", class: "bg-red-100 text-red-700" },
};

function firstProductName(order: B2cOrder): string {
  return order.items[0]?.product?.name ?? "Đơn hàng";
}

export default function OrdersPage() {
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-800">🛒 Đơn hàng của tôi</h1>
        <p className="mt-1 text-sm text-neutral-500">Theo dõi tiến độ các đơn đặt hàng</p>
      </div>

      {loading ? (
        <div className="flex flex-col gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="card h-24 animate-pulse bg-neutral-100" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-10 text-center">
          <span className="text-4xl">📦</span>
          <p className="text-sm text-neutral-500">Bạn chưa có đơn hàng nào</p>
          <Link href="/farmer/diagnose" className="btn-outline text-xs">
            Chẩn đoán & đặt hàng
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/farmer/orders/${order.id}`}
              className="card hover:ring-1 hover:ring-green-400 transition-all"
            >
              <div className="flex items-center justify-between border-b pb-3 mb-3">
                <span className="text-xs font-bold text-neutral-400">
                  #{order.orderNumber.slice(-8).toUpperCase()}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${STATUS_MAP[order.status]?.class}`}
                >
                  {STATUS_MAP[order.status]?.label}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-neutral-800">
                    {firstProductName(order)}
                    {order.items.length > 1 && ` +${order.items.length - 1} sp khác`}
                  </p>
                  <p className="text-[10px] text-neutral-400 mt-0.5">
                    {new Date(order.createdAt).toLocaleString("vi-VN")}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
