import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser, apiOk, apiError } from "@/lib/request";

// POST /api/qr/log — Ghi nhận và theo dõi lịch sử quét QR
export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return apiError("UNAUTHORIZED", 401);

  try {
    const body = await request.json();
    const { productId, code, success } = body;

    if (!code || typeof code !== "string") {
      return apiError("MISSING_CODE", 400);
    }

    const trimmedCode = code.trim();
    const isSuccess = Boolean(success);

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const userAgent = request.headers.get("user-agent") || undefined;

    // Tìm log đã tồn tại của cặp (userId, code)
    const existing = await prisma.qrScanLog.findFirst({
      where: {
        userId: user.id,
        code: trimmedCode,
      },
    });

    const now = new Date();
    const scanEntry = {
      at: now.toISOString(),
      ip,
      ...(userAgent ? { ua: userAgent } : {}),
    };

    if (existing) {
      // Chống spam: nếu quét lại cùng 1 mã trong vòng 10 giây thì bỏ qua không ghi thêm
      const timeDiff = now.getTime() - new Date(existing.lastScannedAt).getTime();
      if (timeDiff > 10_000) {
        const scans = Array.isArray(existing.scans) ? (existing.scans as any[]) : [];
        // Giữ lại tối đa 500 lần quét gần nhất để tránh phình mảng JSON
        const updatedScans = [...scans, scanEntry].slice(-500);

        await prisma.qrScanLog.update({
          where: { id: existing.id },
          data: {
            scanCount: existing.scanCount + 1,
            lastScannedAt: now,
            productId: productId || existing.productId,
            success: isSuccess,
            scans: updatedScans,
          },
        });
      }
    } else {
      await prisma.qrScanLog.create({
        data: {
          userId: user.id,
          code: trimmedCode,
          productId: productId || null,
          success: isSuccess,
          scanCount: 1,
          lastScannedAt: now,
          scans: [scanEntry],
        },
      });
    }

    return apiOk({ status: "logged" });
  } catch (err) {
    console.error("[QR Log Error]", err);
    return apiError("INTERNAL_ERROR", 500);
  }
}
