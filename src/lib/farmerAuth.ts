import { Farmer, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Đăng nhập nông dân: tìm theo SĐT trong bảng farmers,
 * nếu chưa có userId thì tạo User mới với role FARMER và link lại.
 */
export async function resolveFarmerUser(
  phoneVariants: string[],
  loginPhone: string,
  sessionToken: string,
): Promise<User | null> {
  const farmer = await prisma.farmer.findFirst({
    where: { phone: { in: phoneVariants } },
  });
  if (!farmer) return null;

  if (farmer.userId) {
    const linked = await prisma.user.findUnique({ where: { id: farmer.userId } });
    if (!linked) return null;
    return prisma.user.update({
      where: { id: linked.id },
      data: { lastLoginAt: new Date(), sessionToken },
    });
  }

  return prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        phone: farmer.phone ?? loginPhone,
        role: "FARMER",
        name: farmer.name,
        sessionToken,
      },
    });

    let cropIds: string[] = [];
    if (farmer.crop) {
      const normalizeStr = (s: string) =>
        s.toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/^(cay|cây)\s+/i, "")
          .replace(/[^\w\s]/gi, "")
          .replace(/\s+/g, " ")
          .trim();

      const normalizedFarmerCrop = normalizeStr(farmer.crop);
      if (normalizedFarmerCrop) {
        const allCrops = await tx.crop.findMany({
          where: { isActive: true },
        });
        const matchingCrops = allCrops.filter(crop => {
          const normalizedCropName = normalizeStr(crop.name);
          return normalizedCropName === normalizedFarmerCrop;
        });
        cropIds = matchingCrops.map(c => c.id);
      }
    }

    await tx.userProfile.create({
      data: {
        userId: created.id,
        cropIds,
        address: null,
        notes: null,
      },
    });

    await tx.farmer.update({
      where: { id: farmer.id },
      data: { userId: created.id },
    });
    return created;
  });
}

/** Gắn userId vào farmer nếu user FARMER đã tồn tại nhưng chưa link. */
export async function linkFarmerIfMissing(
  user: User,
  phoneVariants: string[],
): Promise<void> {
  if (user.role !== "FARMER") return;

  const farmer = await prisma.farmer.findFirst({
    where: { phone: { in: phoneVariants }, userId: null },
  });
  if (!farmer) return;

  await prisma.farmer.update({
    where: { id: farmer.id },
    data: { userId: user.id },
  });
}
