import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser, requireRole, apiError, apiOk } from "@/lib/request";
import { Role } from "@prisma/client";

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user || !requireRole(user, Role.ADMIN)) return apiError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const roleFilter = searchParams.get("role") || "";
  const activeFilter = searchParams.get("isActive") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const take = 20;
  const skip = (page - 1) * take;

  const andClauses: Record<string, unknown>[] = [];

  if (q) {
    andClauses.push({
      OR: [
        { phone: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (roleFilter && Object.values(Role).includes(roleFilter as Role)) {
    andClauses.push({ role: roleFilter as Role });
  }

  if (activeFilter === "true") andClauses.push({ isActive: true });
  else if (activeFilter === "false") andClauses.push({ isActive: false });

  const where = andClauses.length > 0 ? { AND: andClauses } : {};

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        farmer: true,
        saleProfile: true,
        profile: true,
      }
    })
  ]);

  return apiOk({
    users,
    total,
    page,
    totalPages: Math.ceil(total / take)
  });
}


export async function POST(request: NextRequest) {
  const admin = await getRequestUser(request);
  if (!admin || !requireRole(admin, Role.ADMIN)) return apiError("Unauthorized", 401);

  try {
    const data = await request.json();
    const { phone, name, role } = data;

    if (!phone) return apiError("Số điện thoại là bắt buộc", 400);

    const existingUser = await prisma.user.findUnique({ where: { phone } });
    if (existingUser) return apiError("Số điện thoại này đã tồn tại", 400);

    const user = await prisma.user.create({
      data: {
        phone,
        name,
        role: role || Role.FARMER,
        isActive: true,
      }
    });

    return apiOk(user);
  } catch (error) {
    console.error("Create User Error:", error);
    return apiError("Internal Server Error", 500);
  }
}

