import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser, requireRole, apiError, apiOk } from "@/lib/request";
import { Role } from "@prisma/client";

const VALID_TABS = ["agencies", "farmers", "mdo", "se"] as const;
type TabType = (typeof VALID_TABS)[number];

/**
 * PUT /api/admin/members/[id]
 * Body: { tab, data: { ...fields } }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequestUser(request);
  if (!user || !requireRole(user, Role.ADMIN)) return apiError("Unauthorized", 401);

  const { id } = await params;

  try {
    const body = await request.json();
    const { tab, data } = body;

    if (!VALID_TABS.includes(tab)) return apiError("Tab không hợp lệ", 400);
    if (!data) return apiError("Dữ liệu không hợp lệ", 400);

    switch (tab as TabType) {
      case "agencies": {
        const item = await prisma.agency.update({
          where: { id },
          data: {
            code: data.code,
            name: data.name,
            phone: data.phone || null,
            taxCode: data.taxCode || null,
            salesman: data.salesman || null,
            area: data.area || null,
            address: data.address || null,
            latitude: data.latitude !== undefined ? parseFloat(data.latitude) : undefined,
            longitude: data.longitude !== undefined ? parseFloat(data.longitude) : undefined,
            wardProvince: data.wardProvince || null,
          },
        });
        return apiOk(item);
      }
      case "farmers": {
        const item = await prisma.farmer.update({
          where: { id },
          data: {
            name: data.name,
            phone: data.phone,
            ward: data.ward || null,
            province: data.province || null,
            crop: data.crop || null,
            area: data.area !== undefined ? (data.area ? parseFloat(data.area) : null) : undefined,
            agencyCode: data.agencyCode || null,
            mdo: data.mdo || null,
            se: data.se || null,
          },
        });
        return apiOk(item);
      }
      case "mdo": {
        const item = await prisma.mdo.update({
          where: { id },
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
        const item = await prisma.se.update({
          where: { id },
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
    console.error("[Members API PUT]", error);
    if (error?.code === "P2002") {
      return apiError("Dữ liệu bị trùng (mã hoặc SĐT đã tồn tại)", 400);
    }
    if (error?.code === "P2025") {
      return apiError("Không tìm thấy bản ghi", 404);
    }
    return apiError("Lỗi server", 500);
  }
}

/**
 * DELETE /api/admin/members/[id]
 * Query: ?tab=agencies
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequestUser(request);
  if (!user || !requireRole(user, Role.ADMIN)) return apiError("Unauthorized", 401);

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab") as TabType;

  if (!tab || !VALID_TABS.includes(tab)) return apiError("Tab không hợp lệ", 400);

  try {
    switch (tab) {
      case "agencies":
        await prisma.agency.delete({ where: { id } });
        break;
      case "farmers":
        await prisma.farmer.delete({ where: { id } });
        break;
      case "mdo":
        await prisma.mdo.delete({ where: { id } });
        break;
      case "se":
        await prisma.se.delete({ where: { id } });
        break;
    }
    return apiOk({ success: true, message: "Đã xóa thành công" });
  } catch (error: any) {
    console.error("[Members API DELETE]", error);
    if (error?.code === "P2025") {
      return apiError("Không tìm thấy bản ghi", 404);
    }
    return apiError("Lỗi server", 500);
  }
}
