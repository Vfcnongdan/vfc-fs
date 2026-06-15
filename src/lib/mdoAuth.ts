import { Mdo, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export function mdoUserPhone(mdo: Mdo, loginPhone: string): string {
  return mdo.phone ?? loginPhone;
}

export async function resolveMdoUser(
  phoneVariants: string[],
  loginPhone: string,
  sessionToken: string,
): Promise<User | null> {
  const mdo = await prisma.mdo.findFirst({
    where: { phone: { in: phoneVariants } },
  });
  if (!mdo) return null;

  if (mdo.userId) {
    const linked = await prisma.user.findUnique({ where: { id: mdo.userId } });
    if (!linked) return null;
    return prisma.user.update({
      where: { id: linked.id },
      data: { lastLoginAt: new Date(), sessionToken },
    });
  }

  return prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        phone: mdoUserPhone(mdo, loginPhone),
        role: "MDO",
        name: mdo.name,
        sessionToken,
      },
    });
    await tx.mdo.update({
      where: { id: mdo.id },
      data: { userId: created.id },
    });
    return created;
  });
}

export async function linkMdoIfMissing(
  user: User,
  phoneVariants: string[],
): Promise<void> {
  if (user.role !== "MDO") return;

  const mdo = await prisma.mdo.findFirst({
    where: { phone: { in: phoneVariants }, userId: null },
  });
  if (!mdo) return;

  await prisma.mdo.update({
    where: { id: mdo.id },
    data: { userId: user.id },
  });
}
