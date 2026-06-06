"use client";

import { useEffect, useState } from "react";

type B2cOrder = {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: string;
  createdAt: string;
  buyer: { phone: string; name: string | null };
  seller: { name: string | null; agency?: { name: string } | null };
};

export default function SaleOrdersPage() {
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
    await fetch(`/api/b2c/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setOrders(orders.map((o) => (o.id === id ? { ...o, status } : o)));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-800">🛒 Quản lý đơn hàng B2C</h1>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Đơn hàng</th>
              <th className="px-4 py-3 font-semibold">Nông dân</th>
              <th className="px-4 py-3 font-semibold">Đại lý</th>
              <th className="px-4 py-3 font-semibold">Tổng tiền</th>
              <th className="px-4 py-3 font-semibold">Trạng thái</th>
              <th className="px-4 py-3 font-semibold text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              [1, 2, 3].map((i) => (
                <tr key={i} className="animate-pulse h-12 bg-neutral-50/50" />
              ))
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="hover:bg-neutral-50 transition">
                  <td className="px-4 py-4 font-medium text-neutral-900">
                    #{order.orderNumber.slice(-8).toUpperCase()}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col">
                      <span className="font-medium">{order.buyer.name ?? "Chưa đặt tên"}</span>
                      <span className="text-xs text-neutral-400">{order.buyer.phone}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-neutral-600">
                    {order.seller.agency?.name ?? order.seller.name ?? "—"}
                  </td>
                  <td className="px-4 py-4 font-semibold text-green-700">
                    {Number(order.totalAmount).toLocaleString()}đ
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        order.status === "PENDING"
                          ? "bg-amber-100 text-amber-600"
                          : "bg-green-100 text-green-600"
                      }`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <select
                      className="rounded-lg border-neutral-200 text-xs focus:ring-green-500"
                      value={order.status}
                      onChange={(e) => updateStatus(order.id, e.target.value)}
                    >
                      <option value="PENDING">Chờ duyệt</option>
                      <option value="CONFIRMED">Xác nhận</option>
                      <option value="SHIPPING">Giao hàng</option>
                      <option value="DELIVERED">Hoàn tất</option>
                      <option value="CANCELLED">Hủy đơn</option>
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
