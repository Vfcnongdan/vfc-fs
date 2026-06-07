import { prisma } from "@/lib/prisma";

export async function ensureUserProfile(userId: string): Promise<void> {
  const existing = await prisma.userProfile.findUnique({
    where: { userId },
    select: { userId: true },
  });
  if (existing) return;

  await prisma.userProfile.create({
    data: {
      userId,
      cropIds: [],
      address: null,
      notes: null,
    },
  });
}
