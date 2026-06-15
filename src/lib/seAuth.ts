import { Se, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export function seUserPhone(se: Se, loginPhone: string): string {
  return se.phone ?? loginPhone;
}

export async function resolveSeUser(
  phoneVariants: string[],
  loginPhone: string,
  sessionToken: string,
): Promise<User | null> {
  const se = await prisma.se.findFirst({
    where: { phone: { in: phoneVariants } },
  });
  if (!se) return null;

  if (se.userId) {
    const linked = await prisma.user.findUnique({ where: { id: se.userId } });
    if (!linked) return null;
    return prisma.user.update({
      where: { id: linked.id },
      data: { lastLoginAt: new Date(), sessionToken },
    });
  }

  return prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        phone: seUserPhone(se, loginPhone),
        role: "SE",
        name: se.name,
        sessionToken,
      },
    });
    await tx.se.update({
      where: { id: se.id },
      data: { userId: created.id },
    });
    return created;
  });
}

export async function linkSeIfMissing(
  user: User,
  phoneVariants: string[],
): Promise<void> {
  if (user.role !== "SE") return;

  const se = await prisma.se.findFirst({
    where: { phone: { in: phoneVariants }, userId: null },
  });
  if (!se) return;

  await prisma.se.update({
    where: { id: se.id },
    data: { userId: user.id },
  });
}
