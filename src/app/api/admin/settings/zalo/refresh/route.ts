import { NextRequest } from "next/server";
import { ZaloTokenManager } from "@/services/zalo/ZaloTokenManager";
import { getRequestUser, requireRole, apiError, apiOk } from "@/lib/request";
import { Role } from "@prisma/client";

/**
 * POST /api/admin/settings/zalo/refresh
 * Kích hoạt làm mới Zalo OA Token tức thì (Manual Force Refresh)
 */
export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user || !requireRole(user, Role.ADMIN)) {
    return apiError("Unauthorized", 401);
  }

  try {
    const result = await ZaloTokenManager.getInstance().forceRefresh();

    if (!result.success) {
      return apiError(
        result.error || result.message || "Làm mới Zalo Token thất bại",
        400
      );
    }

    return apiOk({
      success: true,
      message: result.message,
      status: result.data,
    });
  } catch (error: any) {
    return apiError(error?.message || "Lỗi khi kích hoạt làm mới Zalo token", 500);
  }
}
