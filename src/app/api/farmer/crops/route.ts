import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { ensureUserProfile } from "@/lib/userProfile";

export async function GET() {
  const headerList = await headers();
  const userId = headerList.get("x-user-id");

  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    await ensureUserProfile(userId);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { farmer: true },
    });

    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      select: { cropIds: true },
    });

    const profileCropIds = profile?.cropIds ?? [];

    const allCrops = await prisma.crop.findMany({
      where: { isActive: true },
      orderBy: [
        { sortOrder: "asc" },
        { name: "asc" },
      ],
    });

    const cropIdSet = new Set<string>(profileCropIds);

    if (user?.role === "FARMER" && user.farmer?.crop) {
      const farmerCropStr = user.farmer.crop;
      const normalizeStr = (s: string) =>
        s.toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/^(cay|cây)\s+/i, "")
          .replace(/[^\w\s]/gi, "")
          .replace(/\s+/g, " ")
          .trim();

      const normalizedFarmerCrop = normalizeStr(farmerCropStr);

      if (normalizedFarmerCrop) {
        const matchingCrops = allCrops.filter(crop => {
          const normalizedCropName = normalizeStr(crop.name);
          return normalizedCropName === normalizedFarmerCrop;
        });

        for (const crop of matchingCrops) {
          cropIdSet.add(crop.id);
        }
      }
    }

    const crops = allCrops.filter(crop => cropIdSet.has(crop.id));

    return NextResponse.json(crops);
  } catch (error) {
    console.error("[Farmer Crops GET]", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const headerList = await headers();
  const userId = headerList.get("x-user-id");

  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const { cropIds } = await request.json();

    if (!Array.isArray(cropIds)) {
      return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    }

    // 1. Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 401 });
    }

    // 2. Filter valid cropIds so only active catalog IDs are stored.
    const validCrops = await prisma.crop.findMany({
      where: { id: { in: cropIds } },
      select: { id: true }
    });
    const validCropIds = validCrops.map(c => c.id);

    await prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        cropIds: validCropIds,
        address: null,
        notes: null,
      },
      update: {
        cropIds: validCropIds,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Farmer Crops POST]", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
