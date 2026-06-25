import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  b2cOrderListInclude,
  buildB2cLineItems,
  resolveSellerIdFromAgency,
} from "@/lib/b2cOrder";
import { notifyOrderCreated } from "@/lib/notifications";
import { getRequestUser, apiError, apiOk } from "@/lib/request";
import { Role } from "@prisma/client";

const createSchema = z.object({
  agencyId: z.string().min(1),
  items: z
    .array(
      z.object({
        productId: z.string().optional(),
        productDetailId: z.string().optional(),
        quantity: z.number().int().min(1),
      }),
    )
    .min(1),
  note: z.string().optional(),
  deliveryAddr: z
    .object({
      province: z.string(),
      district: z.string(),
      ward: z.string(),
      address: z.string(),
    })
    .optional(),
});

function listWhereForRole(user: { id: string; role: Role }) {
  if (user.role === Role.FARMER) return { buyerId: user.id };
  if (user.role === Role.AGENCY || user.role === Role.SUPER_AGENT) {
    return { sellerId: user.id };
  }
  return {};
}

// GET /api/b2c/orders
export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return apiError("UNAUTHORIZED", 401);

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? 20)));
  const where = listWhereForRole(user);

  const [total, orders] = await Promise.all([
    prisma.b2cOrder.count({ where }),
    prisma.b2cOrder.findMany({
      where,
      include: b2cOrderListInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return apiOk({ data: orders, total, page, limit });
}

// POST /api/b2c/orders — nông dân đặt hàng qua đại lý cấp 2
export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return apiError("UNAUTHORIZED", 401);
  if (user.role !== Role.FARMER) return apiError("FORBIDDEN", 403);

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiError("INVALID_INPUT", 400);

  const { agencyId, items, note, deliveryAddr } = parsed.data;

  const sellerResult = await resolveSellerIdFromAgency(agencyId);
  if ("error" in sellerResult) {
    return apiError(sellerResult.error, sellerResult.status);
  }

  const lineResult = await buildB2cLineItems(sellerResult.sellerId, items);
  if (!lineResult.ok) {
    return apiError(lineResult.error, lineResult.status);
  }

  const order = await prisma.b2cOrder.create({
    data: {
      buyerId: user.id,
      sellerId: sellerResult.sellerId,
      totalAmount: 0,
      note,
      deliveryAddr,
      items: { create: lineResult.items },
    },
    include: b2cOrderListInclude,
  });

  await notifyOrderCreated(order);

  return apiOk(order, 201);
}
