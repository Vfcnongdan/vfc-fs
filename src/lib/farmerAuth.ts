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
