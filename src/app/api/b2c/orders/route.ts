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
import { OrderStatus, Prisma, Role } from "@prisma/client";

const createSchema = z.object({
  agencyId: z.string().min(1),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
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

function listWhereForRole(user: { id: string; role: Role }): Prisma.B2cOrderWhereInput {
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
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 20)));
  const roleWhere = listWhereForRole(user);
  const where: Prisma.B2cOrderWhereInput = { ...roleWhere };

  // 1. Status filter
  const statusParam = searchParams.get("status")?.trim().toUpperCase();
  if (statusParam && statusParam !== "ALL") {
    if (Object.values(OrderStatus).includes(statusParam as OrderStatus)) {
      where.status = statusParam as OrderStatus;
    }
  }

  // 2. Search keyword (orderNumber, buyer, seller, agency, product)
  const search = searchParams.get("search")?.trim();
  if (search) {
    where.OR = [
      { orderNumber: { contains: search, mode: "insensitive" } },
      { buyer: { name: { contains: search, mode: "insensitive" } } },
      { buyer: { phone: { contains: search } } },
      { seller: { name: { contains: search, mode: "insensitive" } } },
      { seller: { agency: { name: { contains: search, mode: "insensitive" } } } },
      { seller: { agency: { code: { contains: search, mode: "insensitive" } } } },
      { items: { some: { product: { name: { contains: search, mode: "insensitive" } } } } },
    ];
  }

  // 3. Date range filter
  const startDate = searchParams.get("startDate")?.trim();
  const endDate = searchParams.get("endDate")?.trim();
  if (startDate || endDate) {
    const createdAtFilter: Prisma.DateTimeFilter = {};
    if (startDate) {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) {
        start.setHours(0, 0, 0, 0);
        createdAtFilter.gte = start;
      }
    }
    if (endDate) {
      const end = new Date(endDate);
      if (!isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        createdAtFilter.lte = end;
      }
    }
    if (createdAtFilter.gte || createdAtFilter.lte) {
      where.createdAt = createdAtFilter;
    }
  }

  // 4. Sorting
  const sort = searchParams.get("sort")?.trim() === "oldest" ? "asc" : "desc";

  // Base where for status counts (without status filter)
  const countWhere: Prisma.B2cOrderWhereInput = { ...where };
  delete countWhere.status;

  const [total, orders, statusGroups] = await Promise.all([
    prisma.b2cOrder.count({ where }),
    prisma.b2cOrder.findMany({
      where,
      include: b2cOrderListInclude,
      orderBy: { createdAt: sort },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.b2cOrder.groupBy({
      by: ["status"],
      where: countWhere,
      _count: { status: true },
    }),
  ]);

  const counts: Record<string, number> = {
    ALL: 0,
    PENDING: 0,
    CONFIRMED: 0,
    SHIPPING: 0,
    DELIVERED: 0,
    CANCELLED: 0,
  };

  for (const group of statusGroups) {
    counts[group.status] = group._count.status;
    counts.ALL += group._count.status;
  }

  return apiOk({
    data: orders,
    total,
    page,
    limit,
    statusCounts: counts,
  });
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
