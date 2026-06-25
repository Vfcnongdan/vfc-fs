import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser, apiError, apiOk } from "@/lib/request";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getRequestUser(request);
  if (!user || user.role !== "ADMIN") return apiError("UNAUTHORIZED", 401);

  const product = await prisma.product.findUnique({
    where: { id },
    include: { detail: true },
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
    const { name, sku, slug, unit, stock, isActive, detail, categoryId } = body;

    const product = await prisma.product.update({
      where: { id },
      data: {
        name,
        sku,
        slug,
        price: 0,
        unit,
        stock,
        isActive,
        categoryId,
        detail: detail ? {
          upsert: {
            create: { name: name || "", ...detail },
            update: { name: name || "", ...detail },
          },
        } : undefined,
      },
      include: { detail: true },
    });

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
    return apiOk({ success: true });
  } catch (error) {
    console.error("[Admin Product DELETE]", error);
    return apiError("INTERNAL_ERROR", 500);
  }
}
