import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser, apiError, apiOk } from "@/lib/request";

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return apiError("Unauthorized", 401);

  if (user.role === "FARMER") {
    const farmer = await prisma.farmer.findFirst({
      where: { userId: user.id },
      select: { mdo: true },
    });

    if (!farmer?.mdo) {
      return apiError("MDO not assigned", 404);
    }

    // Match mdo field against Mdo.name or Mdo.employeeCode
    const mdo = await prisma.mdo.findFirst({
      where: {
        OR: [
          { name: { equals: farmer.mdo, mode: "insensitive" } },
          { employeeCode: { equals: farmer.mdo, mode: "insensitive" } },
        ],
      },
      select: { phone: true, name: true },
    });

    if (!mdo?.phone) {
      return apiError("MDO phone not found", 404);
    }

    return apiOk({ phone: mdo.phone, name: mdo.name, role: "MDO" });
  }

  if (user.role === "AGENCY") {
    const agency = await prisma.agency.findFirst({
      where: { userId: user.id },
      select: { salesman: true },
    });

    if (!agency?.salesman) {
      return apiError("SE not assigned", 404);
    }

    // Match salesman field against Se.name or Se.employeeCode
    const se = await prisma.se.findFirst({
      where: {
        OR: [
          { name: { equals: agency.salesman, mode: "insensitive" } },
          { employeeCode: { equals: agency.salesman, mode: "insensitive" } },
        ],
      },
      select: { phone: true, name: true },
    });

    if (!se?.phone) {
      return apiError("SE phone not found", 404);
    }

    return apiOk({ phone: se.phone, name: se.name, role: "SE" });
  }

  return apiError("Role not supported", 403);
}
