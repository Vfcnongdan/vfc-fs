import { prisma } from "@/lib/prisma";

export async function ensureUserProfile(userId: string): Promise<void> {
  try {
    await prisma.userProfile.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        cropIds: [],
        address: null,
        notes: null,
      },
    });
  } catch (err: any) {
    if (err?.code !== "P2002") {
      throw err;
    }
  }
}
