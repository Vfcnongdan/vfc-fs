import { NextRequest } from "next/server";
import { ZaloOtpService } from "@/services/otp/ZaloOtpService";
import { getRequestUser, requireRole, apiError, apiOk } from "@/lib/request";
import { Role } from "@prisma/client";

/**
 * POST /api/admin/settings/zalo/test-otp
 * Gửi OTP test tới một số điện thoại để xác nhận Zalo token còn hoạt động
 */
export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user || !requireRole(user, Role.ADMIN)) {
    return apiError("Unauthorized", 401);
  }

  try {
    const body = await request.json();
    const { phone } = body;

    if (!phone || typeof phone !== "string" || !phone.trim()) {
      return apiError("Vui lòng nhập số điện thoại hợp lệ", 400);
    }

    const cleanPhone = phone.trim().replace(/\s+/g, "");
    const phoneRegex = /^(0|\+84)[3-9]\d{8}$/;
    if (!phoneRegex.test(cleanPhone)) {
      return apiError("Số điện thoại không hợp lệ. Vui lòng nhập số Việt Nam (09x, 08x, 03x...)", 400);
    }

    const testOtp = "123456";
    const service = new ZaloOtpService(undefined, true);

    // recipientId dùng cho OA Message fallback — để trống vì đây chỉ là test ZNS
    const success = await service.sendOtp("", testOtp, cleanPhone);

    if (!success) {
      return apiError(
        "Gửi OTP test thất bại. Zalo token có thể đã hết hạn, sai ZNS template ID hoặc tài khoản OA chưa đủ số dư/quyền gửi.",
        502
      );
    }

    return apiOk({
      success: true,
      message: `Đã kết nối Zalo API và gửi OTP test (${testOtp}) tới ${cleanPhone} thành công!`,
    });
  } catch (error: any) {
    return apiError(error?.message || "Lỗi khi gửi OTP test", 500);
  }
}
