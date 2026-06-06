import { prisma } from "@/lib/prisma";
import type { AgencyWithDistance } from "@/services/agencyService";

export type OrderCatalogItem = {
  productId: string;
  productDetailId: string;
  name: string;
  slug: string;
  price: number;
  stock: number;
  unit: string;
};

export type AgencyOrderCatalog = {
  suggested: OrderCatalogItem[];
  additional: OrderCatalogItem[];
};

function mapInventoryToCatalogItem(inv: {
  quantity: number;
  productDetailId: string;
  productDetail: {
    product: {
      id: string;
      name: string;
      slug: string;
      price: { toString(): string };
      unit: string;
    };
  };
}): OrderCatalogItem {
  const { product } = inv.productDetail;
  return {
    productId: product.id,
    productDetailId: inv.productDetailId,
    name: product.name,
    slug: product.slug,
    price: Number(product.price),
    stock: inv.quantity,
    unit: product.unit,
  };
}

/** Chỉ giữ đại lý đã link user và còn ít nhất một SP gợi ý trong kho. */
export async function filterAgenciesForOrder(
  agencies: AgencyWithDistance[],
  suggestionProductIds: string[],
): Promise<AgencyWithDistance[]> {
  if (agencies.length === 0 || suggestionProductIds.length === 0) return [];

  const agencyRows = await prisma.agency.findMany({
    where: {
      id: { in: agencies.map((a) => a.id) },
      userId: { not: null },
    },
    select: { id: true, userId: true },
  });

  if (agencyRows.length === 0) return [];

  const ownerIds = [...new Set(agencyRows.map((a) => a.userId!))];
  const inventories = await prisma.inventory.findMany({
    where: {
      ownerId: { in: ownerIds },
      quantity: { gt: 0 },
      productDetail: { productId: { in: suggestionProductIds } },
    },
    select: {
      ownerId: true,
      productDetail: { select: { productId: true } },
    },
  });

  const stockedByOwner = new Map<string, Set<string>>();
  for (const inv of inventories) {
    const set = stockedByOwner.get(inv.ownerId) ?? new Set<string>();
    set.add(inv.productDetail.productId);
    stockedByOwner.set(inv.ownerId, set);
  }

  const orderableAgencyIds = new Set(
    agencyRows
      .filter((a) => {
        const stocked = stockedByOwner.get(a.userId!);
        if (!stocked) return false;
        return suggestionProductIds.some((pid) => stocked.has(pid));
      })
      .map((a) => a.id),
  );

  return agencies.filter((a) => orderableAgencyIds.has(a.id));
}

export async function getAgencyOrderCatalog(
  agencyId: string,
  suggestionProductIds: string[],
): Promise<AgencyOrderCatalog | null> {
  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: { userId: true },
  });
  if (!agency?.userId) return null;

  const inventories = await prisma.inventory.findMany({
    where: { ownerId: agency.userId, quantity: { gt: 0 } },
    include: {
      productDetail: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              price: true,
              unit: true,
            },
          },
        },
      },
    },
    orderBy: { productDetail: { name: "asc" } },
  });

  const suggestionSet = new Set(suggestionProductIds);
  const suggested: OrderCatalogItem[] = [];
  const additional: OrderCatalogItem[] = [];

  for (const inv of inventories) {
    const item = mapInventoryToCatalogItem(inv);
    if (suggestionSet.has(item.productId)) {
      suggested.push(item);
    } else {
      additional.push(item);
    }
  }

  return { suggested, additional };
}
