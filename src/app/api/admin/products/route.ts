import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser, apiError, apiOk } from "@/lib/request";

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user || user.role !== "ADMIN") return apiError("UNAUTHORIZED", 401);

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = 20;
  const skip = (page - 1) * limit;

  try {
    const [total, products] = await Promise.all([
      prisma.product.count(),
      prisma.product.findMany({
        include: { detail: true, category: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return apiOk({
      products,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[Admin Products GET]", error);
    return apiError("INTERNAL_ERROR", 500);
  }
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user || user.role !== "ADMIN") return apiError("UNAUTHORIZED", 401);

  try {
    const body = await request.json();
    const { name, sku, slug, price, unit, stock, isActive, detail, categoryId, imageUrls } = body;

    const cleanDetail = detail ? {
      name: name || "",
      plantCrops: detail.plantCrops || null,
      type: detail.type || null,
      ingredients: detail.ingredients || null,
      targetDiseases: detail.targetDiseases || null,
      usageInstruction: detail.usageInstruction || null,
      description: detail.description || null,
    } : undefined;

    const product = await prisma.product.create({
      data: {
        name,
        sku,
        slug: slug || name.toLowerCase().trim().replace(/ /g, "-"),
        price: price ? Number(price) : 0,
        unit: unit || "chai",
        stock: stock || 0,
        isActive: isActive !== undefined ? isActive : true,
        categoryId: categoryId || null,
        imageUrls: imageUrls || [],
        detail: cleanDetail ? { create: cleanDetail } : undefined,
      },
      include: { detail: true, category: true },
    });

    return apiOk(product);
  } catch (error) {
    console.error("[Admin Products POST]", error);
    return apiError("INTERNAL_ERROR", 500);
  }
}
