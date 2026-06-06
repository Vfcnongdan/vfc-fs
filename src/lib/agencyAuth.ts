import { Agency, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Số điện thoại lưu trên user khi tạo từ agency (ưu tiên SĐT trong bảng agencies). */
export function agencyUserPhone(agency: Agency, loginPhone: string): string {
  return agency.phone ?? loginPhone;
}

/**
 * Đăng nhập đại lý: dùng user theo SĐT, hoặc agency.userId (gán tay), hoặc tạo user mới + gắn agency.
 */
export async function resolveAgencyUser(
  phoneVariants: string[],
  loginPhone: string,
  sessionToken: string,
): Promise<User | null> {
  const agency = await prisma.agency.findFirst({
    where: { phone: { in: phoneVariants } },
  });
  if (!agency) return null;

  if (agency.userId) {
    const linked = await prisma.user.findUnique({ where: { id: agency.userId } });
    if (!linked) return null;
    return prisma.user.update({
      where: { id: linked.id },
      data: { lastLoginAt: new Date(), sessionToken },
    });
  }

  return prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        phone: agencyUserPhone(agency, loginPhone),
        role: "AGENCY",
        name: agency.name,
        sessionToken,
      },
    });
    await tx.agency.update({
      where: { id: agency.id },
      data: { userId: created.id },
    });
    return created;
  });
}

/** Gắn userId vào agency nếu user AGENCY đã tồn tại nhưng chưa link (migrate dần). */
export async function linkAgencyIfMissing(
  user: User,
  phoneVariants: string[],
): Promise<void> {
  if (user.role !== "AGENCY") return;

  const agency = await prisma.agency.findFirst({
    where: { phone: { in: phoneVariants }, userId: null },
  });
  if (!agency) return;

  await prisma.agency.update({
    where: { id: agency.id },
    data: { userId: user.id },
  });
}
