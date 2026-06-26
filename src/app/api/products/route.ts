import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiOk } from "@/lib/request";

// GET /api/products — public product listing
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? 20)));
  const category = searchParams.get("category");
  const q = searchParams.get("q");

  const where = {
    isActive: true,
    ...(category ? { category: { slug: category } } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { tags: { has: q } },
          ],
        }
      : {}),
  };

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        sku: true,
        slug: true,
        description: true,
        imageUrls: true,
        price: true,
        unit: true,
        stock: true,
        isActive: true,
        category: { select: { name: true, slug: true } },
        detail: { select: { id: true, targetDiseases: true, usageInstruction: true, description: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return apiOk({ data: products, total, page, limit });
}
