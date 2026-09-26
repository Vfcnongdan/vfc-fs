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
 * PUT /api/admin/settings/zalo
 * Nhận Access Token và Refresh Token trực tiếp từ Admin UI, lưu vào Database
 */
export async function PUT(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user || !requireRole(user, Role.ADMIN)) {
    return apiError("Unauthorized", 401);
  }

  try {
    const body = await request.json();
    const { accessToken, refreshToken } = body;

    if (!accessToken || typeof accessToken !== "string" || !accessToken.trim()) {
      return apiError("Vui lòng nhập Access Token hợp lệ", 400);
    }
    if (!refreshToken || typeof refreshToken !== "string" || !refreshToken.trim()) {
      return apiError("Vui lòng nhập Refresh Token hợp lệ", 400);
    }

    if (accessToken.trim() === refreshToken.trim()) {
      return apiError(
        "Access Token và Refresh Token không được giống nhau! Access Token dùng để gửi OTP (hạn 25 giờ), còn Refresh Token là mã riêng biệt dùng để làm mới token (hạn 90 ngày). Vui lòng lấy đúng mã Refresh Token từ Zalo Developer Console.",
        400
      );
    }

    // Access Token mặc định 90.000 giây (~25 giờ) theo chuẩn Zalo
    const expiresInSeconds = 90000;
    // Refresh Token Zalo có hạn 90 ngày
    const refreshTokenExpiresInSeconds = 90 * 24 * 60 * 60;

    await ZaloTokenManager.getInstance().saveTokens(
      accessToken.trim(),
      refreshToken.trim(),
      expiresInSeconds,
      true,
      refreshTokenExpiresInSeconds
    );

    return apiOk({
      success: true,
      message: "Đã lưu Access Token và Refresh Token vào Database thành công!",
      data: {
        expiresInSeconds,
        accessTokenMasked: accessToken.trim().substring(0, 10) + "...",
        refreshTokenMasked: refreshToken.trim().substring(0, 10) + "...",
      },
    });
  } catch (error: any) {
    return apiError(error?.message || "Lỗi khi lưu Zalo tokens", 500);
  }
}

/**
 * PATCH /api/admin/settings/zalo
 * Cập nhật cấu hình chứng thực Zalo (bật/tắt hoặc cập nhật ngưỡng tự động làm mới)
 */
export async function PATCH(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user || !requireRole(user, Role.ADMIN)) {
    return apiError("Unauthorized", 401);
  }

  try {
    const body = await request.json();
    const { enabled, refreshThresholdSeconds } = body;

    let updatedEnabled: boolean | undefined;
    let updatedThreshold: number | undefined;

    if (typeof enabled === "boolean") {
      updatedEnabled = await ZaloTokenManager.getInstance().setAuthEnabled(enabled);
    }

    if (refreshThresholdSeconds !== undefined) {
      const thresholdNum = Number(refreshThresholdSeconds);
      if (isNaN(thresholdNum) || thresholdNum < 60 || thresholdNum > 86400) {
        return apiError(
          "Ngưỡng tự động làm mới phải là số nguyên từ 60 giây (1 phút) đến 86.400 giây (24 giờ).",
          400
        );
      }
      updatedThreshold = await ZaloTokenManager.getInstance().setRefreshThreshold(thresholdNum);
    }

    if (updatedEnabled === undefined && updatedThreshold === undefined) {
      return apiError("Vui lòng cung cấp 'enabled' hoặc 'refreshThresholdSeconds' để cập nhật", 400);
    }

    const currentStatus = await ZaloTokenManager.getInstance().getTokenStatus();

    return apiOk({
      success: true,
      message: "Cập nhật cấu hình Zalo thành công.",
      enabled: updatedEnabled ?? currentStatus.enabled,
      refreshThresholdSeconds: updatedThreshold ?? currentStatus.refreshThresholdSeconds,
      status: currentStatus,
    });
  } catch (error: any) {
    return apiError(error?.message || "Không thể cập nhật cấu hình Zalo", 400);
  }
}
