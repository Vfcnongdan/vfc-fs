import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { b2cOrderDetailInclude } from "@/lib/b2cOrder";
import { notifyOrderStatusChanged } from "@/lib/notifications";
import { getRequestUser, apiError, apiOk } from "@/lib/request";
import { Role, OrderStatus } from "@prisma/client";

function canAccessOrder(
  user: { id: string; role: Role },
  order: { buyerId: string; sellerId: string },
): boolean {
  if (user.role === Role.FARMER) return order.buyerId === user.id;
  if (user.role === Role.AGENCY || user.role === Role.SUPER_AGENT) {
    return order.sellerId === user.id;
  }
  return user.role === Role.ADMIN || user.role === Role.SALE;
}

// GET /api/b2c/orders/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getRequestUser(request);
  if (!user) return apiError("UNAUTHORIZED", 401);

  const { id } = await params;
  const order = await prisma.b2cOrder.findUnique({
    where: { id },
    include: b2cOrderDetailInclude,
  });

  if (!order) return apiError("NOT_FOUND", 404);
  if (!canAccessOrder(user, order)) return apiError("FORBIDDEN", 403);

  return apiOk(order);
}

const patchSchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
  note: z.string().optional(),
});

// PATCH /api/b2c/orders/[id] — đại lý / sale / admin cập nhật trạng thái
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getRequestUser(request);
  if (!user) return apiError("UNAUTHORIZED", 401);
  if (user.role === Role.FARMER) return apiError("FORBIDDEN", 403);

  const { id } = await params;
  const existing = await prisma.b2cOrder.findUnique({
    where: { id },
    select: { buyerId: true, sellerId: true, status: true },
  });
  if (!existing) return apiError("NOT_FOUND", 404);

  if (user.role === Role.AGENCY || user.role === Role.SUPER_AGENT) {
    if (existing.sellerId !== user.id) return apiError("FORBIDDEN", 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return apiError("INVALID_INPUT", 400);

  const updated = await prisma.b2cOrder.update({
    where: { id },
    data: parsed.data,
    include: b2cOrderDetailInclude,
  });

  if (parsed.data.status) {
    await notifyOrderStatusChanged(updated, existing.status);
  }

  return apiOk(updated);
}
