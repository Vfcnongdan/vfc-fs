import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const b2cOrderListInclude = {
  items: {
    include: {
      product: {
        select: { id: true, name: true, sku: true, imageUrls: true, unit: true },
      },
    },
  },
  buyer: { select: { id: true, phone: true, name: true } },
  seller: { select: { id: true, phone: true, name: true } },
} satisfies Prisma.B2cOrderInclude;

export const b2cOrderDetailInclude = {
  items: {
    include: {
      product: {
        include: { detail: { select: { id: true, targetDiseases: true, usageInstruction: true, description: true } } },
      },
    },
  },
  buyer: { select: { id: true, phone: true, name: true } },
  seller: {
    select: {
      id: true,
      phone: true,
      name: true,
      agency: { select: { id: true, name: true, code: true, address: true, phone: true } },
    },
  },
} satisfies Prisma.B2cOrderInclude;

type LineInput = { productId: string; quantity: number };

export async function buildB2cLineItems(
  sellerId: string,
  lines: LineInput[],
): Promise<
  | { ok: true; items: { productId: string; quantity: number; price: number }[] }
  | { ok: false; error: string; status: number }
> {
  const productIds = lines.map((l) => l.productId);

  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
    select: { id: true },
  });

  const validIds = new Set(products.map((p) => p.id));
  for (const line of lines) {
    if (!validIds.has(line.productId)) {
      return { ok: false, error: "PRODUCT_NOT_FOUND_OR_INACTIVE", status: 400 };
    }
  }

  const items = lines.map((line) => ({
    productId: line.productId,
    quantity: line.quantity,
    price: 0,
  }));

  return { ok: true, items };
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
