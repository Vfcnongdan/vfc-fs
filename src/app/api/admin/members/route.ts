import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser, requireRole, apiError, apiOk } from "@/lib/request";
import { Role } from "@prisma/client";

const VALID_TABS = ["agencies", "farmers", "mdo", "se"] as const;
type TabType = (typeof VALID_TABS)[number];
const PAGE_SIZE = 15;

function buildFuzzyWhere(q: string) {
  if (!q) return {};
  return {
    OR: [
      { name: { contains: q, mode: "insensitive" as const } },
      { phone: { contains: q, mode: "insensitive" as const } },
    ],
  };
}

/**
 * GET /api/admin/members?tab=agencies&q=search&page=1
 */
export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user || !requireRole(user, Role.ADMIN)) return apiError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const tab = (searchParams.get("tab") || "agencies") as TabType;
  const q = searchParams.get("q") || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const skip = (page - 1) * PAGE_SIZE;

  if (!VALID_TABS.includes(tab)) {
    return apiError("Tab không hợp lệ", 400);
  }

  try {
    const where = buildFuzzyWhere(q);

    switch (tab) {
      case "agencies": {
        // Agency phone is optional so we need special handling
        const agencyWhere = q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" as const } },
                { phone: { contains: q, mode: "insensitive" as const } },
                { code: { contains: q, mode: "insensitive" as const } },
                { area: { contains: q, mode: "insensitive" as const } },
                { address: { contains: q, mode: "insensitive" as const } },
                { wardProvince: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {};
        const [total, items] = await Promise.all([
          prisma.agency.count({ where: agencyWhere }),
          prisma.agency.findMany({
            where: agencyWhere,
            orderBy: { createdAt: "desc" },
            skip,
            take: PAGE_SIZE,
          }),
        ]);
        return apiOk({ items, total, page, totalPages: Math.ceil(total / PAGE_SIZE) });
      }
      case "farmers": {
        const farmerWhere = q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" as const } },
                { phone: { contains: q, mode: "insensitive" as const } },
                { province: { contains: q, mode: "insensitive" as const } },
                { agencyCode: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {};
        const [total, items] = await Promise.all([
          prisma.farmer.count({ where: farmerWhere }),
          prisma.farmer.findMany({
            where: farmerWhere,
            orderBy: { createdAt: "desc" },
            skip,
            take: PAGE_SIZE,
          }),
        ]);
        return apiOk({ items, total, page, totalPages: Math.ceil(total / PAGE_SIZE) });
      }
      case "mdo": {
        const mdoWhere = q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" as const } },
                { phone: { contains: q, mode: "insensitive" as const } },
                { employeeCode: { contains: q, mode: "insensitive" as const } },
                { region: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {};
        const [total, items] = await Promise.all([
          prisma.mdo.count({ where: mdoWhere }),
          prisma.mdo.findMany({
            where: mdoWhere,
            orderBy: { createdAt: "desc" },
            skip,
            take: PAGE_SIZE,
          }),
        ]);
        return apiOk({ items, total, page, totalPages: Math.ceil(total / PAGE_SIZE) });
      }
      case "se": {
        const seWhere = q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" as const } },
                { phone: { contains: q, mode: "insensitive" as const } },
                { employeeCode: { contains: q, mode: "insensitive" as const } },
                { region: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {};
        const [total, items] = await Promise.all([
          prisma.se.count({ where: seWhere }),
          prisma.se.findMany({
            where: seWhere,
            orderBy: { createdAt: "desc" },
            skip,
            take: PAGE_SIZE,
          }),
        ]);
        return apiOk({ items, total, page, totalPages: Math.ceil(total / PAGE_SIZE) });
      }
    }
  } catch (error: any) {
    console.error("[Members API GET]", error);
    return apiError("Lỗi server", 500);
  }
}

/**
 * POST /api/admin/members
 * Body: { tab, data: { ...fields } }
 */
export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user || !requireRole(user, Role.ADMIN)) return apiError("Unauthorized", 401);

  try {
    const body = await request.json();
    const { tab, data } = body;

    if (!VALID_TABS.includes(tab)) return apiError("Tab không hợp lệ", 400);
    if (!data) return apiError("Dữ liệu không hợp lệ", 400);

    switch (tab as TabType) {
      case "agencies": {
        if (!data.code || !data.name) return apiError("Mã đại lý và Tên là bắt buộc", 400);
        const item = await prisma.agency.create({
          data: {
            code: data.code,
            name: data.name,
            phone: data.phone || null,
            taxCode: data.taxCode || null,
            salesman: data.salesman || null,
            area: data.area || null,
            address: data.address || null,
            latitude: parseFloat(data.latitude) || 0,
            longitude: parseFloat(data.longitude) || 0,
            wardProvince: data.wardProvince || null,
          },
        });
        return apiOk(item);
      }
      case "farmers": {
        if (!data.name || !data.phone) return apiError("Tên và SĐT là bắt buộc", 400);
        const item = await prisma.farmer.create({
          data: {
            name: data.name,
            phone: data.phone,
            ward: data.ward || null,
            province: data.province || null,
            crop: data.crop || null,
            area: data.area ? parseFloat(data.area) : null,
            agencyCode: data.agencyCode || null,
            mdo: data.mdo || null,
            se: data.se || null,
          },
        });
        return apiOk(item);
      }
      case "mdo": {
        if (!data.name || !data.employeeCode || !data.phone) return apiError("Tên, Mã NV và SĐT là bắt buộc", 400);
        const item = await prisma.mdo.create({
          data: {
            name: data.name,
            employeeCode: data.employeeCode,
            phone: data.phone,
            region: data.region || null,
            check: data.check || null,
          },
        });
        return apiOk(item);
      }
      case "se": {
        if (!data.name || !data.employeeCode || !data.phone) return apiError("Tên, Mã NV và SĐT là bắt buộc", 400);
        const item = await prisma.se.create({
          data: {
            name: data.name,
            employeeCode: data.employeeCode,
            phone: data.phone,
            region: data.region || null,
            area: data.area || null,
            location: data.location || null,
            email: data.email || null,
          },
        });
        return apiOk(item);
      }
    }
  } catch (error: any) {
    console.error("[Members API POST]", error);
    if (error?.code === "P2002") {
      return apiError("Dữ liệu bị trùng (mã hoặc SĐT đã tồn tại)", 400);
    }
    return apiError("Lỗi server", 500);
  }
}
