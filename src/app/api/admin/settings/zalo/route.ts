import { NextRequest } from "next/server";
import { ZaloTokenManager } from "@/services/zalo/ZaloTokenManager";
import { getRequestUser, requireRole, apiError, apiOk } from "@/lib/request";
import { Role } from "@prisma/client";

/**
 * GET /api/admin/settings/zalo
 * Trả về thông tin trạng thái Zalo Authentication hiện tại
 */
export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user || !requireRole(user, Role.ADMIN)) {
    return apiError("Unauthorized", 401);
  }

  try {
    const status = await ZaloTokenManager.getInstance().getTokenStatus();
    return apiOk({ success: true, status });
  } catch (error: any) {
    return apiError(error?.message || "Lỗi khi lấy trạng thái Zalo token", 500);
  }
}

/**
 * POST /api/admin/settings/zalo
 * Nhận authorization_code từ Admin UI và kích hoạt chứng thực Zalo
 */
export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user || !requireRole(user, Role.ADMIN)) {
    return apiError("Unauthorized", 401);
  }

  try {
    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== "string" || !code.trim()) {
      return apiError("Vui lòng nhập Authorization Code hợp lệ", 400);
    }

    const result = await ZaloTokenManager.getInstance().exchangeAuthorizationCode(code.trim());

    if (!result.success) {
      return apiError(result.error || "Kích hoạt chứng thực Zalo thất bại", 400);
    }

    return apiOk({
      success: true,
      message: result.message,
      data: result.data,
    });
  } catch (error: any) {
    return apiError(error?.message || "Lỗi khi kích hoạt chứng thực Zalo", 500);
  }
}

/**
 * PATCH /api/admin/settings/zalo
 * Bật hoặc Tắt trạng thái chứng thực Zalo
 */
export async function PATCH(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user || !requireRole(user, Role.ADMIN)) {
    return apiError("Unauthorized", 401);
  }

  try {
    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled !== "boolean") {
      return apiError("Tham số 'enabled' phải là giá trị boolean", 400);
    }

    const updatedEnabled = await ZaloTokenManager.getInstance().setAuthEnabled(enabled);

    return apiOk({
      success: true,
      message: updatedEnabled
        ? "Đã BẬT chứng thực Zalo thành công."
        : "Đã TẮT chứng thực Zalo thành công.",
      enabled: updatedEnabled,
    });
  } catch (error: any) {
    return apiError(error?.message || "Không thể cập nhật trạng thái chứng thực Zalo", 400);
  }
}
