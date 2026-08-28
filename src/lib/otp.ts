import bcrypt from "bcryptjs";
import { getPhoneVariants } from "./phone";
import { prisma } from "./prisma";

const OTP_TTL_MINUTES = 5;
const MAX_ATTEMPTS = 5;
const COOLDOWN_SECONDS = 60; // 60s cooldown giữa 2 lần gửi
const WINDOW_MINUTES = 15;
const MAX_REQUESTS_PER_WINDOW = 5; // Tối đa 5 lần gửi / 15 phút

export async function checkOtpRateLimit(phone: string): Promise<{
  allowed: boolean;
  reason?: "COOLDOWN" | "RATE_LIMITED";
  message?: string;
  retryAfter?: number;
}> {
  const variants = getPhoneVariants(phone);
  if (variants.length === 0) return { allowed: true };

  // 1. Kiểm tra Cooldown 60s từ lần yêu cầu gần nhất
  const latestOtp = await prisma.otpRequest.findFirst({
    where: { phone: { in: variants } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  if (latestOtp) {
    const elapsedSeconds = Math.floor((Date.now() - latestOtp.createdAt.getTime()) / 1000);
    if (elapsedSeconds < COOLDOWN_SECONDS) {
      const waitSeconds = COOLDOWN_SECONDS - elapsedSeconds;
      return {
        allowed: false,
        reason: "COOLDOWN",
        message: `Vui lòng đợi ${waitSeconds} giây trước khi yêu cầu mã mới.`,
        retryAfter: waitSeconds,
      };
    }
  }

  // 2. Kiểm tra Rate Limit theo cửa sổ 15 phút
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);
  const recentCount = await prisma.otpRequest.count({
    where: {
      phone: { in: variants },
      createdAt: { gte: windowStart },
    },
  });

  if (recentCount >= MAX_REQUESTS_PER_WINDOW) {
    return {
      allowed: false,
      reason: "RATE_LIMITED",
      message: `Bạn đã yêu cầu gửi mã quá ${MAX_REQUESTS_PER_WINDOW} lần. Vui lòng thử lại sau ${WINDOW_MINUTES} phút.`,
      retryAfter: WINDOW_MINUTES * 60,
    };
  }

  return { allowed: true };
}

export function generateOtp(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export async function createOtpRecord(phone: string, fixedOtp?: string): Promise<string> {
  const variants = getPhoneVariants(phone);
  const otp = fixedOtp ?? generateOtp();
  const hashed = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  // Invalidate old OTPs for this phone (any stored format)
  await prisma.otpRequest.updateMany({
    where: { phone: { in: variants }, verified: false },
    data: { expiresAt: new Date(0) }, // expire immediately
  });

  await prisma.otpRequest.create({
    data: { phone, otp: hashed, expiresAt },
  });

  return otp; // return plaintext to send via Zalo
}

export async function verifyOtp(
  phone: string,
  plainOtp: string
): Promise<{ valid: boolean; reason?: string; message?: string }> {
  const variants = getPhoneVariants(phone);
  const record = await prisma.otpRequest.findFirst({
    where: {
      phone: { in: variants },
      verified: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!record) {
    return {
      valid: false,
      reason: "OTP_NOT_FOUND_OR_EXPIRED",
      message: "Mã OTP đã hết hạn hoặc không tồn tại. Vui lòng yêu cầu mã mới.",
    };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    return {
      valid: false,
      reason: "MAX_ATTEMPTS_EXCEEDED",
      message: "Bạn đã nhập sai quá số lần cho phép (5 lần). Vui lòng yêu cầu mã mới.",
    };
  }

  const match = await bcrypt.compare(plainOtp, record.otp);

  await prisma.otpRequest.update({
    where: { id: record.id },
    data: {
      attempts: { increment: 1 },
      verified: match,
    },
  });

  if (!match) {
    const remaining = MAX_ATTEMPTS - (record.attempts + 1);
    return {
      valid: false,
      reason: "INVALID_OTP",
      message:
        remaining > 0
          ? `Mã OTP không chính xác. Bạn còn ${remaining} lần thử.`
          : "Bạn đã nhập sai quá 5 lần. Vui lòng yêu cầu mã mới.",
    };
  }

  return { valid: true };
}
