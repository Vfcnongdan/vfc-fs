"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

const STATUS_MAP: Record<string, string> = {
  PENDING: "Chờ duyệt",
  CONFIRMED: "Đã xác nhận",
  SHIPPING: "Đang giao",
  DELIVERED: "Hoàn tất",
  CANCELLED: "Đã hủy",
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/b2c/orders/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setOrder(data);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <div className="card h-40 animate-pulse bg-neutral-100" />;
  }

  if (!order?.id) {
    return (
      <div className="card text-center py-10">
        <p className="text-neutral-500">Không tìm thấy đơn hàng</p>
        <Link href="/farmer/orders" className="btn-outline text-xs mt-4 inline-block">
          Quay lại
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/farmer/orders" className="text-sm text-green-700 font-semibold">
        ← Danh sách đơn
      </Link>

      <div className="card">
        <div className="flex justify-between items-start border-b pb-4 mb-4">
          <div>
            <h1 className="text-lg font-bold text-neutral-800">
              #{order.orderNumber.slice(-8).toUpperCase()}
            </h1>
            <p className="text-xs text-neutral-400 mt-1">
              {new Date(order.createdAt).toLocaleString("vi-VN")}
            </p>
          </div>
          <span className="text-xs font-bold uppercase text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
            {STATUS_MAP[order.status] ?? order.status}
          </span>
        </div>

        {order.seller?.agency && (
          <p className="text-sm text-neutral-600 mb-4">
            Đại lý: <strong>{order.seller.agency.name}</strong>
            {order.seller.agency.address && ` — ${order.seller.agency.address}`}
            {order.seller.agency.phone && ` - ${order.seller.agency.phone}`}
          </p>
        )}

        <ul className="divide-y divide-neutral-100">
          {order.items?.map((item: any) => (
            <li key={item.id} className="py-3 flex justify-between gap-4">
              <div>
                <p className="font-medium text-neutral-800">
                  {item.productDetail?.product?.name}
                </p>
                <p className="text-xs text-neutral-400">SL: {item.quantity}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
