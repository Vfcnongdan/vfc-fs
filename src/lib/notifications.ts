import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Chờ duyệt",
  CONFIRMED: "Đã xác nhận",
  SHIPPING: "Đang giao",
  DELIVERED: "Hoàn tất",
  CANCELLED: "Đã hủy",
};

type RelatedOrder = {
  id: string;
  orderNumber: string;
  buyerId: string;
  sellerId: string;
  status: OrderStatus;
};

function relatedRecipientIds(order: Pick<RelatedOrder, "buyerId" | "sellerId">) {
  return Array.from(new Set([order.buyerId, order.sellerId].filter(Boolean)));
}

function shortOrderNumber(orderNumber: string) {
  return orderNumber.slice(-8).toUpperCase();
}

export async function notifyOrderCreated(order: RelatedOrder) {
  const orderCode = shortOrderNumber(order.orderNumber);
  const recipients = relatedRecipientIds(order);
  if (recipients.length === 0) return;

  await prisma.notification.createMany({
    data: recipients.map((recipientId) => ({
      recipientId,
      orderId: order.id,
      type: "ORDER_CREATED",
      title: `Đơn hàng #${orderCode} vừa được tạo`,
      message: "Đơn hàng mới đang chờ xử lý.",
    })),
  });
}

export async function notifyOrderStatusChanged(
  order: RelatedOrder,
  previousStatus: OrderStatus,
) {
  if (order.status === previousStatus) return;

  const orderCode = shortOrderNumber(order.orderNumber);
  const recipients = relatedRecipientIds(order);
  if (recipients.length === 0) return;

  await prisma.notification.createMany({
    data: recipients.map((recipientId) => ({
      recipientId,
      orderId: order.id,
      type: "ORDER_STATUS_CHANGED",
      title: `Đơn hàng #${orderCode} đổi trạng thái`,
      message: `Trạng thái mới: ${STATUS_LABELS[order.status] ?? order.status}.`,
    })),
  });
}

export function notificationHrefForRole(role: string, orderId: string) {
  if (role === "FARMER") return `/farmer/orders/${orderId}`;
  if (role === "AGENCY" || role === "SUPER_AGENT") {
    return `/agent/orders?orderId=${orderId}`;
  }
  return `/sale/orders`;
}
