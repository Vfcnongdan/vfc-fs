import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, getRequestUser } from "@/lib/request";

// PATCH /api/notifications/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getRequestUser(request);
  if (!user) return apiError("UNAUTHORIZED", 401);

  const { id } = await params;
  const notification = await prisma.notification.findFirst({
    where: { id, recipientId: user.id },
    select: { id: true, isRead: true },
  });

  if (!notification) return apiError("NOT_FOUND", 404);

  if (!notification.isRead) {
    await prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  return apiOk({ ok: true });
}
