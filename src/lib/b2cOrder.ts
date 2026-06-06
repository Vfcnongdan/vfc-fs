import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const b2cOrderListInclude = {
  items: {
    include: {
      productDetail: {
        include: {
          product: { select: { id: true, name: true, sku: true, imageUrls: true, unit: true } },
        },
      },
    },
  },
  buyer: { select: { id: true, phone: true, name: true } },
  seller: { select: { id: true, phone: true, name: true } },
} satisfies Prisma.B2cOrderInclude;

export const b2cOrderDetailInclude = {
  items: {
    include: {
      productDetail: {
        include: { product: true },
      },
    },
  },
  buyer: { select: { id: true, phone: true, name: true } },
  seller: {
    select: {
      id: true,
      phone: true,
      name: true,
      agency: { select: { id: true, name: true, code: true, address: true } },
    },
  },
} satisfies Prisma.B2cOrderInclude;

type LineInput = { productId?: string; productDetailId?: string; quantity: number };

export async function resolveProductDetailId(
  line: LineInput,
): Promise<string | null> {
  if (line.productDetailId) return line.productDetailId;
  if (!line.productId) return null;
  const detail = await prisma.productDetail.findUnique({
    where: { productId: line.productId },
    select: { id: true },
  });
  return detail?.id ?? null;
}

export async function buildB2cLineItems(
  sellerId: string,
  lines: LineInput[],
): Promise<
  | { ok: true; items: { productDetailId: string; quantity: number; price: Prisma.Decimal }[]; totalAmount: number }
  | { ok: false; error: string; status: number }
> {
  const resolved: { productDetailId: string; quantity: number }[] = [];

  for (const line of lines) {
    const productDetailId = await resolveProductDetailId(line);
    if (!productDetailId) {
      return { ok: false, error: "PRODUCT_NOT_IN_CATALOG", status: 400 };
    }
    resolved.push({ productDetailId, quantity: line.quantity });
  }

  const detailIds = resolved.map((r) => r.productDetailId);
  const details = await prisma.productDetail.findMany({
    where: { id: { in: detailIds } },
    include: { product: { select: { price: true, isActive: true } } },
  });
  const detailMap = new Map(details.map((d) => [d.id, d]));

  const inventories = await prisma.inventory.findMany({
    where: {
      ownerId: sellerId,
      productDetailId: { in: detailIds },
    },
  });
  const stockMap = new Map(inventories.map((i) => [i.productDetailId, i.quantity]));

  let totalAmount = 0;
  const items: { productDetailId: string; quantity: number; price: Prisma.Decimal }[] = [];

  for (const line of resolved) {
    const detail = detailMap.get(line.productDetailId);
    if (!detail?.product.isActive) {
      return { ok: false, error: "PRODUCT_NOT_FOUND_OR_INACTIVE", status: 400 };
    }

    // Stock check removed - allow orders regardless of inventory
    const unitPrice = detail.product.price;
    totalAmount += Number(unitPrice) * line.quantity;
    items.push({
      productDetailId: line.productDetailId,
      quantity: line.quantity,
      price: unitPrice,
    });
  }

  return { ok: true, items, totalAmount };
}

export async function resolveSellerIdFromAgency(
  agencyId: string,
): Promise<{ sellerId: string } | { error: string; status: number }> {
  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: { userId: true, name: true },
  });
  if (!agency) return { error: "AGENCY_NOT_FOUND", status: 404 };
  if (!agency.userId) {
    return { error: "AGENCY_NOT_LINKED_TO_USER", status: 400 };
  }
  return { sellerId: agency.userId };
}
