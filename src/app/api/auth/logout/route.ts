import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    // 1. Lấy userId từ header (nếu qua middleware) hoặc giải mã token trực tiếp
    let userId = request.headers.get("x-user-id");

    if (!userId) {
      const authHeader = request.headers.get("authorization");
      const bearerToken = authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : null;
      const token = bearerToken || request.cookies.get(COOKIE_NAME)?.value;

      if (token) {
        const session = await verifyToken(token);
        userId = session?.sub || null;
      }
    }

    // 2. Thu hồi session trên Server: Xóa sessionToken trong Database
    if (userId) {
      await prisma.user
        .update({
          where: { id: userId },
          data: { sessionToken: null },
        })
        .catch((err) => {
          logger.warn(`[Logout] Could not clear sessionToken for user ${userId}:`, err);
        });
      logger.info(`[Logout] Successfully revoked session for user: ${userId}`);
    }

    // 3. Xóa cookie trên trình duyệt
    const response = NextResponse.json({ success: true, message: "Đăng xuất thành công" });
    response.cookies.delete(COOKIE_NAME);
    return response;
  } catch (err: any) {
    logger.error("[Logout Error]", err);
    const response = NextResponse.json({ success: true, message: "Đăng xuất hoàn tất" });
    response.cookies.delete(COOKIE_NAME);
    return response;
  }
}
