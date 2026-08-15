import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser, apiOk, apiError } from "@/lib/request";

// POST /api/qr/log — Backfill userId after login for anonymous QR scans
export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return apiError("UNAUTHORIZED", 401);

  try {
    const body = await request.json();
    const { productId, code, success } = body;

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    if (success) {
      if (!productId) return apiError("MISSING_PRODUCT_ID", 400);

      const existing = await prisma.qrScanLog.findUnique({
        where: { userId_productId: { userId: user.id, productId } },
      });

      if (existing) {
        // Anti-spam: skip if last scan < 30 seconds ago
        const timeDiff = Date.now() - new Date(existing.lastScannedAt).getTime();
        if (timeDiff > 30_000) {
          const scans = Array.isArray(existing.scans) ? existing.scans : [];
          await prisma.qrScanLog.update({
            where: { id: existing.id },
            data: {
              scanCount: existing.scanCount + 1,
              lastScannedAt: new Date(),
              scans: [...scans, { at: new Date().toISOString(), success: true, ip, code }],
            },
          });
        }
      } else {
        await prisma.qrScanLog.create({
          data: {
            userId: user.id,
            productId,
            scans: [{ at: new Date().toISOString(), success: true, ip, code }],
          },
        });
      }
    } else {
      // Failed scan (invalid code)
      if (!code) return apiError("MISSING_CODE", 400);
      
      const existing = await prisma.qrScanLog.findFirst({
        where: { userId: user.id, productId: null },
      });

      if (existing) {
        const timeDiff = Date.now() - new Date(existing.lastScannedAt).getTime();
        if (timeDiff > 5_000) { // 5s anti-spam for failed scans
          const scans = Array.isArray(existing.scans) ? existing.scans : [];
          await prisma.qrScanLog.update({
            where: { id: existing.id },
            data: {
              scanCount: existing.scanCount + 1,
              lastScannedAt: new Date(),
              scans: [...scans, { at: new Date().toISOString(), success: false, code, ip }],
            },
          });
        }
      } else {
        await prisma.qrScanLog.create({
          data: {
            userId: user.id,
            productId: null,
            scans: [{ at: new Date().toISOString(), success: false, code, ip }],
          },
        });
      }
    }

    return apiOk({ status: "logged" });
  } catch (err) {
    console.error("[QR Log]", err);
    return apiError("INTERNAL_ERROR", 500);
  }
}
