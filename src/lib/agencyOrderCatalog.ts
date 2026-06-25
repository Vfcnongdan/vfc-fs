import { prisma } from "@/lib/prisma";
import type { AgencyWithDistance } from "@/services/agencyService";

export type OrderCatalogItem = {
  productId: string;
  productDetailId: string;
  name: string;
  slug: string;
  stock: number;
  unit: string;
  imageUrls: string[];
};

export type AgencyOrderCatalog = {
  suggested: OrderCatalogItem[];
  additional: OrderCatalogItem[];
};

/** Chỉ giữ đại lý đã link user (không check inventory). */
export async function filterAgenciesForOrder(
  agencies: AgencyWithDistance[],
): Promise<AgencyWithDistance[]> {
  if (agencies.length === 0) return [];

  const agencyRows = await prisma.agency.findMany({
    where: {
      id: { in: agencies.map((a) => a.id) },
      userId: { not: null },
    },
    select: { id: true },
  });

  const linkedAgencyIds = new Set(agencyRows.map((a) => a.id));
  return agencies.filter((a) => linkedAgencyIds.has(a.id));
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

  const allProducts = await prisma.product.findMany({
    where: { isActive: true, detail: { isNot: null } },
    select: {
      id: true,
      name: true,
      slug: true,
      unit: true,
      imageUrls: true,
      detail: {
        select: { id: true },
      },
    },
  });

  const suggestionSet = new Set(suggestionProductIds);
  const suggested: OrderCatalogItem[] = [];
  const additional: OrderCatalogItem[] = [];

  for (const product of allProducts) {
    const item: OrderCatalogItem = {
      productId: product.id,
      productDetailId: product.detail?.id ?? "",
      name: product.name,
      slug: product.slug,
      stock: 0,
      unit: product.unit,
      imageUrls: product.imageUrls,
    };

    if (suggestionSet.has(product.id)) {
      suggested.push(item);
    } else {
      additional.push(item);
    }
  }

  return { suggested, additional };
}
