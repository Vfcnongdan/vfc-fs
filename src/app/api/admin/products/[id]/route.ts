import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser, apiError, apiOk } from "@/lib/request";
import { invalidateDiagnosisProductsCache } from "@/services/productCacheDiagnosis";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getRequestUser(request);
  if (!user || user.role !== "ADMIN") return apiError("UNAUTHORIZED", 401);

  const product = await prisma.product.findUnique({
    where: { id },
    include: { detail: true, category: true },
  });

  if (!product) return apiError("NOT_FOUND", 404);
  return apiOk(product);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

    const product = await prisma.product.update({
      where: { id },
      data: {
        name,
        sku,
        slug,
        price: price !== undefined ? Number(price) : undefined,
        unit,
        stock,
        isActive,
        categoryId: categoryId !== undefined ? categoryId : undefined,
        imageUrls: imageUrls !== undefined ? imageUrls : undefined,
        detail: cleanDetail ? {
          upsert: {
            create: cleanDetail,
            update: cleanDetail,
          },
        } : undefined,
      },
      include: { detail: true, category: true },
    });

    invalidateDiagnosisProductsCache();
    return apiOk(product);
  } catch (error) {
    console.error("[Admin Product PUT]", error);
    return apiError("INTERNAL_ERROR", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getRequestUser(request);
  if (!user || user.role !== "ADMIN") return apiError("UNAUTHORIZED", 401);

  try {
    await prisma.product.delete({ where: { id } });
    invalidateDiagnosisProductsCache();
    return apiOk({ success: true });
  } catch (error) {
    console.error("[Admin Product DELETE]", error);
    return apiError("INTERNAL_ERROR", 500);
  }
}
