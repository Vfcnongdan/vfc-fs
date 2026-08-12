import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiOk, apiError } from "@/lib/request";

// GET /api/products/[id] — Public product details by ID or Slug
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return apiError("BAD_REQUEST", 400);
  }

  // Find product by id or slug
  const product = await prisma.product.findFirst({
    where: {
      OR: [
        { id },
        { slug: id },
      ],
      isActive: true,
    },
    include: {
      category: {
        select: { id: true, name: true, slug: true },
      },
      detail: true,
    },
  });

  if (!product) {
    return apiError("NOT_FOUND", 404);
  }

  // Find related products (same category or general active products)
  const related = await prisma.product.findMany({
    where: {
      isActive: true,
      id: { not: product.id },
      ...(product.categoryId ? { categoryId: product.categoryId } : {}),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      imageUrls: true,
      unit: true,
      price: true,
      category: { select: { name: true } },
      detail: { select: { targetDiseases: true, plantCrops: true } },
    },
    take: 4,
    orderBy: { createdAt: "desc" },
  });

  // If not enough related products in category, get other products
  let finalRelated = related;
  if (related.length < 4) {
    const extraRelated = await prisma.product.findMany({
      where: {
        isActive: true,
        id: { notIn: [product.id, ...related.map((r) => r.id)] },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        imageUrls: true,
        unit: true,
        price: true,
        category: { select: { name: true } },
        detail: { select: { targetDiseases: true, plantCrops: true } },
      },
      take: 4 - related.length,
      orderBy: { createdAt: "desc" },
    });
    finalRelated = [...related, ...extraRelated];
  }

  return apiOk({
    product,
    related: finalRelated,
  });
}
