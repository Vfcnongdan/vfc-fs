import { NextRequest } from "next/server";
import { z } from "zod";
import { createOtpRecord, checkOtpRateLimit } from "@/lib/otp";
import { isPhoneAuthorizedForOtp } from "@/lib/otpAuth";
import { getPhoneVariants, isValidVietnamesePhone } from "@/lib/phone";
import { OtpController } from "@/controllers/OtpController";
import { OtpServiceFactory } from "@/services/otp/OtpServiceFactory";

const schema = z.object({
  phone: z
    .string()
    .min(1, "Vui lòng nhập số điện thoại")
    .refine(isValidVietnamesePhone, "Số điện thoại không đúng định dạng di động Việt Nam"),
  chatId: z.string().optional(),
  provider: z.enum(["telegram", "zalo", "all"]).optional(), // Hỗ trợ chỉ định "telegram", "zalo" hoặc "all" (gửi cả 2)
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    const errorMsg = parsed.error.issues[0]?.message || "Số điện thoại không hợp lệ";
    return Response.json(
      { error: "INVALID_PHONE", message: errorMsg, details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { phone, chatId, provider: requestedProvider } = parsed.data;

  try {
    const phoneVariants = getPhoneVariants(phone);
    const authorized = await isPhoneAuthorizedForOtp(phoneVariants);

    if (!authorized) {
      return Response.json(
        {
          error: "PHONE_NOT_AUTHORIZED",
          message: "Số điện thoại này chưa được đăng ký trong hệ thống VFC",
        },
        { status: 403 }
      );
    }

    // Dev bypass: số điện thoại bắt đầu bằng 09883664 sẽ dùng OTP cố định 1111
    const normalizedPhone = phone.replace(/\D/g, "");
    const isDevBypass =
      process.env.NODE_ENV !== "production" &&
      /^(09883664\d{2}|849883664\d{2})$/.test(normalizedPhone);

    if (isDevBypass) {
      await createOtpRecord(phone, "1111");
      console.log(`[DEV BYPASS] OTP for ${phone}: 1111`);
      return Response.json({ success: true, message: "Mã OTP thử nghiệm đã được kích hoạt" });
    }

    // Kiểm tra Rate Limit & Cooldown (60s giữa 2 lần gửi, tối đa 5 lần / 15 phút)
    const rateLimitCheck = await checkOtpRateLimit(phone);
    if (!rateLimitCheck.allowed) {
      return Response.json(
        {
          error: rateLimitCheck.reason,
          message: rateLimitCheck.message,
          retryAfter: rateLimitCheck.retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimitCheck.retryAfter || 60),
          },
        }
      );
    }

    const otp = await createOtpRecord(phone);

    // Xác định kênh gửi OTP. Mặc định là "all" (gửi đồng thời cả Zalo lẫn Telegram)
    const activeProvider =
      requestedProvider || process.env.OTP_SERVICE_PROVIDER || "all";

    const otpService = OtpServiceFactory.create(activeProvider, {
      phone,
      chatId,
    });
    const otpController = new OtpController(otpService);

    let target = chatId || phone;
    if (activeProvider === "telegram" && process.env.TELEGRAM_CHAT_ID) {
      target = process.env.TELEGRAM_CHAT_ID;
    }

    // Gửi OTP qua service đã chọn (nếu activeProvider === 'all', sẽ gửi song song cả 2 kênh)
    const sentSuccess = await otpController.send(target, otp, phone);

    if (!sentSuccess) {
      return Response.json(
        { error: "OTP_SEND_FAILED", message: "Gửi OTP qua Zalo/Telegram thất bại. Vui lòng thử lại" },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      message:
        activeProvider === "all"
          ? "Mã OTP đã được gửi đồng thời qua Zalo và Telegram"
          : `Mã OTP đã được gửi qua ${activeProvider}`,
      channel: activeProvider,
    });
  } catch (err) {
    console.error("[OTP Send Error]", err);
    return Response.json({ error: "INTERNAL_ERROR", message: "Có lỗi xảy ra ở máy chủ. Vui lòng thử lại sau" }, { status: 500 });
  }
}
