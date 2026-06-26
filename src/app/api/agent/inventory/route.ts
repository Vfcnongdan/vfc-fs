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
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            imageUrls: true,
            unit: true,
            detail: { select: { targetDiseases: true, usageInstruction: true, description: true } },
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
    const { productId, quantity } = body;

    if (!productId || typeof quantity !== "number" || quantity < 0) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found in company catalog" }, { status: 404 });
    }

    const inventory = await prisma.inventory.upsert({
      where: {
        ownerId_productId: {
          ownerId: userId,
          productId,
        },
      },
      update: {
        quantity,
      },
      create: {
        ownerId: userId,
        productId,
        quantity,
      },
    });

    return NextResponse.json({ data: inventory });
  } catch (error) {
    console.error("[Inventory POST Error]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
