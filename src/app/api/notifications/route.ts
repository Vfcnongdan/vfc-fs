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
      take: 10,
      include: {
        order: { select: { id: true, orderNumber: true, status: true } },
      },
    }),
  ]);

  return apiOk({
    unreadCount,
    notifications: notifications.map((notification) => ({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
      readAt: notification.readAt,
      order: notification.order,
      href: notificationHrefForRole(user.role, notification.orderId),
    })),
  });
}
