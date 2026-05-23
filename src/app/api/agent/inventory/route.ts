import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const inventories = await prisma.inventory.findMany({
      where: { ownerId: userId },
      include: {
        productDetail: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                imageUrls: true,
                unit: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ data: inventories });
  } catch (error) {
    console.error("[Inventory GET Error]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { productDetailId, quantity } = body;

    if (!productDetailId || typeof quantity !== "number" || quantity < 0) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    // Xác thực sản phẩm có tồn tại trong hệ thống hay không
    const productDetail = await prisma.productDetail.findUnique({
      where: { id: productDetailId },
    });

    if (!productDetail) {
      return NextResponse.json({ error: "Product not found in company catalog" }, { status: 404 });
    }

    // Upsert inventory
    const inventory = await prisma.inventory.upsert({
      where: {
        ownerId_productDetailId: {
          ownerId: userId,
          productDetailId,
        },
      },
      update: {
        quantity, // Replace with new quantity (can also be an increment based on business logic, but absolute value is simpler for UI)
      },
      create: {
        ownerId: userId,
        productDetailId,
        quantity,
      },
    });

    return NextResponse.json({ data: inventory });
  } catch (error) {
    console.error("[Inventory POST Error]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
