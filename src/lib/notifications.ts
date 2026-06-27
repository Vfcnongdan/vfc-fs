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

async function resolveMdoUserId(buyerId: string): Promise<string | null> {
  const farmer = await prisma.farmer.findFirst({
    where: { userId: buyerId },
    select: { mdo: true },
  });
  if (!farmer?.mdo) return null;
  const mdo = await prisma.mdo.findFirst({
    where: {
      OR: [
        { name: { equals: farmer.mdo, mode: "insensitive" } },
        { employeeCode: { equals: farmer.mdo, mode: "insensitive" } },
      ],
    },
    select: { userId: true },
  });
  return mdo?.userId ?? null;
}

async function resolveSeUserId(sellerId: string): Promise<string | null> {
  const agency = await prisma.agency.findFirst({
    where: { userId: sellerId },
    select: { salesman: true },
  });
  if (!agency?.salesman) return null;
  const se = await prisma.se.findFirst({
    where: {
      OR: [
        { name: { equals: agency.salesman, mode: "insensitive" } },
        { employeeCode: { equals: agency.salesman, mode: "insensitive" } },
      ],
    },
    select: { userId: true },
  });
  return se?.userId ?? null;
}

async function relatedRecipientIds(order: Pick<RelatedOrder, "buyerId" | "sellerId">): Promise<string[]> {
  const [mdoUserId, seUserId] = await Promise.all([
    resolveMdoUserId(order.buyerId),
    resolveSeUserId(order.sellerId),
  ]);
  return Array.from(new Set([order.buyerId, order.sellerId, mdoUserId, seUserId].filter((id): id is string => Boolean(id))));
}

function shortOrderNumber(orderNumber: string) {
  return orderNumber.slice(-8).toUpperCase();
}

export async function notifyOrderCreated(order: RelatedOrder) {
  const orderCode = shortOrderNumber(order.orderNumber);
  const recipients = await relatedRecipientIds(order);
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
  const recipients = await relatedRecipientIds(order);
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

export function notificationHrefForRole(
  role: string,
  type: string,
  orderId: string | null,
  cropChangeRequestId: string | null,
) {
  if (type === "CROP_CHANGE_REQUESTED" && cropChangeRequestId) {
    return `/admin/crop-change-requests?focus=${cropChangeRequestId}`;
  }
  if (type === "CROP_CHANGE_PENDING" && cropChangeRequestId) {
    return `/farmer`;
  }
  if (
    (type === "CROP_CHANGE_APPROVED" || type === "CROP_CHANGE_REJECTED") &&
    cropChangeRequestId
  ) {
    return `/farmer`;
  }
  if (!orderId) return `/farmer`;
  if (role === "FARMER") return `/farmer/orders/${orderId}`;
  if (role === "AGENCY" || role === "SUPER_AGENT" || role === "MDO" || role === "SE") {
    return `/admin/orders?orderId=${orderId}`;
  }
  return `/admin/orders?orderId=${orderId}`;
}
