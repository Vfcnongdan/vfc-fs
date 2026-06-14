import { NextRequest } from "next/server";
import { z } from "zod";
import { createOtpRecord } from "@/lib/otp";
import { isPhoneAuthorizedForOtp } from "@/lib/otpAuth";
import { getPhoneVariants, isValidVietnamesePhone } from "@/lib/phone";
import { OtpController } from "@/controllers/OtpController";
import { TelegramOtpService } from "@/services/otp/TelegramOtpService";
const schema = z.object({
  phone: z
    .string()
    .min(1)
    .refine(isValidVietnamesePhone, "Số điện thoại không hợp lệ"),
  chatId: z.string().optional(), // Thêm chatId cho Telegram
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "INVALID_PHONE", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { phone, chatId } = parsed.data;
 
  try {
    const phoneVariants = getPhoneVariants(phone);

    const authorized = await isPhoneAuthorizedForOtp(phoneVariants);

    if (!authorized) {
      return Response.json(
        { error: "PHONE_NOT_AUTHORIZED", message: "Số điện thoại không được phép truy cập hệ thống" },
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
      return Response.json({ success: true, message: "OTP đã được gửi" });
    }

    const otp = await createOtpRecord(phone);
    
    // Khởi tạo service dựa trên cấu hình ENV
    let otpService;
    const provider = process.env.OTP_SERVICE_PROVIDER || 'telegram';
    let target = chatId || phone;

    if (provider === 'zalo') {
      const { ZaloOtpService } = await import("@/services/otp/ZaloOtpService");
      otpService = new ZaloOtpService(process.env.ZALO_OA_TOKEN!);
    } else {
      otpService = new TelegramOtpService(process.env.TELEGRAM_BOT_TOKEN!);
      // Nếu có cố định Chat ID trong ENV thì dùng luôn, không quan trọng input
      if (process.env.TELEGRAM_CHAT_ID) {
        target = process.env.TELEGRAM_CHAT_ID;
      }
    }

    const otpController = new OtpController(otpService);

    // Gửi OTP
    await otpController.send(target, otp, phone);
    
    return Response.json({ success: true, message: "OTP đã được gửi" });
  } catch (err) {
    console.error("[OTP Send Error]", err);
    return Response.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
