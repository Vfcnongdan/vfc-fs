import { prisma } from "@/lib/prisma";

/** SĐT được phép gửi OTP: đã có trong users, agencies hoặc farmers. */
export async function isPhoneAuthorizedForOtp(
  phoneVariants: string[],
): Promise<boolean> {
  if (phoneVariants.length === 0) return false;

  const [user, agency, farmer] = await Promise.all([
    prisma.user.findFirst({
      where: { phone: { in: phoneVariants } },
      select: { id: true },
    }),
    prisma.agency.findFirst({
      where: { phone: { in: phoneVariants } },
      select: { id: true },
    }),
    prisma.farmer.findFirst({
      where: { phone: { in: phoneVariants } },
      select: { id: true },
    }),
  ]);

  return !!(user || agency || farmer);
}
