import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { notificationHrefForRole } from "@/lib/notifications";
import { apiError, apiOk, getRequestUser } from "@/lib/request";

// GET /api/notifications
export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return apiError("UNAUTHORIZED", 401);

  const [unreadCount, notifications] = await Promise.all([
    prisma.notification.count({
      where: { recipientId: user.id, isRead: false },
    }),
    prisma.notification.findMany({
      where: { recipientId: user.id, isRead: false },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        order: { select: { id: true, orderNumber: true, status: true } },
        cropChangeRequest: { select: { id: true, status: true } },
      },
    }),
  ]);

  const latestByOrder = new Map<string, (typeof notifications)[number]>();
  const standalone: (typeof notifications)[number][] = [];

  for (const n of notifications) {
    if (n.orderId) {
      if (!latestByOrder.has(n.orderId)) {
        latestByOrder.set(n.orderId, n);
      }
    } else {
      standalone.push(n);
    }
  }

  const grouped = [...latestByOrder.values(), ...standalone].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return apiOk({
    unreadCount,
    notifications: grouped.map((notification) => ({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
      readAt: notification.readAt,
      order: notification.order,
      cropChangeRequest: notification.cropChangeRequest,
      href: notificationHrefForRole(
        user.role,
        notification.type,
        notification.orderId,
        notification.cropChangeRequestId,
      ),
    })),
  });
}
