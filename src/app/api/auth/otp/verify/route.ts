import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyOtp } from "@/lib/otp";
import { signToken, COOKIE_NAME, COOKIE_OPTIONS } from "@/lib/auth";
import { linkAgencyIfMissing, resolveAgencyUser } from "@/lib/agencyAuth";
import { linkFarmerIfMissing, resolveFarmerUser } from "@/lib/farmerAuth";
import { linkMdoIfMissing, resolveMdoUser } from "@/lib/mdoAuth";
import { linkSeIfMissing, resolveSeUser } from "@/lib/seAuth";
import { getPhoneVariants, isValidVietnamesePhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { ensureUserProfile } from "@/lib/userProfile";
import { logger } from "@/lib/logger";
import crypto from "crypto";

const schema = z.object({
  phone: z.string().refine(isValidVietnamesePhone),
  otp: z.string().length(4),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: "INVALID_INPUT", message: "Thông tin nhập không hợp lệ" }, { status: 400 });
    }

    const { phone, otp } = parsed.data;
    const result = await verifyOtp(phone, otp);

    if (!result.valid) {
      return Response.json(
        { error: result.reason, message: result.message || "Xác thực OTP thất bại" },
        { status: 401 }
      );
    }

    const sessionToken = crypto.randomUUID();

    const phoneVariants = getPhoneVariants(phone);

    let user = await prisma.user.findFirst({
      where: { phone: { in: phoneVariants } },
    });

    if (user) {
      if (!user.isActive) {
        return Response.json(
          {
            error: "ACCOUNT_DISABLED",
            message: "Tài khoản của bạn đã bị tạm khóa. Vui lòng liên hệ quản trị viên.",
          },
          { status: 403 }
        );
      }

      await linkAgencyIfMissing(user, phoneVariants);
      await linkFarmerIfMissing(user, phoneVariants);
      await linkMdoIfMissing(user, phoneVariants);
      await linkSeIfMissing(user, phoneVariants);
      user = await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date(), sessionToken },
      });
    } else {
      user = await resolveAgencyUser(phoneVariants, phone, sessionToken);
      if (!user) {
        user = await resolveMdoUser(phoneVariants, phone, sessionToken);
      }
      if (!user) {
        user = await resolveSeUser(phoneVariants, phone, sessionToken);
      }
      if (!user) {
        user = await resolveFarmerUser(phoneVariants, phone, sessionToken);
      }
      if (!user) {
        return Response.json({ error: "PHONE_NOT_AUTHORIZED" }, { status: 403 });
      }
    }

    await ensureUserProfile(user.id);

    const token = await signToken({ sub: user.id, phone: user.phone, role: user.role, sessionId: sessionToken });

    const response = NextResponse.json({
      user: { id: user.id, phone: user.phone, role: user.role, name: user.name },
    });

    response.cookies.set(COOKIE_NAME, token, COOKIE_OPTIONS);
    return response;
  } catch (err: any) {
    logger.error("[OTP Verify Error]", err);
    return Response.json({ error: "INTERNAL_SERVER_ERROR", message: err.message }, { status: 500 });
  }
}
