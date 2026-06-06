import { prisma } from "@/lib/prisma";

export async function ensureUserProfile(userId: string): Promise<void> {
  const existing = await prisma.userProfile.findUnique({
    where: { userId },
    select: { userId: true },
  });
  if (existing) return;

  // Seed cropIds from legacy user_crops join table.
  const userCrops = await prisma.userCrop.findMany({
    where: { userId },
    select: { cropId: true },
  });

  await prisma.userProfile.create({
    data: {
      userId,
      cropIds: userCrops.map((uc) => uc.cropId),
      address: null,
      notes: null,
    },
  });
}

