import { CropChangeRequestStatus, Role } from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, getRequestUser } from "@/lib/request";

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return apiError("UNAUTHORIZED", 401);

  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") as CropChangeRequestStatus | null;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = 20;

  const isMdo = user.role === "MDO" || user.role === "MDM" || user.role === "CV_CM";
  const isAdmin = user.role === "ADMIN";
  if (!isMdo && !isAdmin) {
    return apiError("FORBIDDEN", 403);
  }

  const where: Record<string, unknown> = {};

  if (isMdo) {
    const mdo = await prisma.mdo.findFirst({
      where: { userId: user.id },
    });
    if (!mdo) return apiOk({ data: [], total: 0, page, limit });
    where.reviewerId = user.id;
  }

  if (status && Object.values(CropChangeRequestStatus).includes(status)) {
    where.status = status;
  }

  const [total, requests] = await Promise.all([
    prisma.cropChangeRequest.count({ where }),
    prisma.cropChangeRequest.findMany({
      where,
      include: {
        requester: { select: { id: true, name: true, phone: true, role: true } },
        reviewer: { select: { id: true, name: true, phone: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const allCropIds = Array.from(
    new Set(requests.flatMap((r) => [...r.currentCropIds, ...r.requestedCropIds])),
  );
  const cropsById = allCropIds.length === 0
    ? new Map()
    : new Map(
        (await prisma.crop.findMany({
          where: { id: { in: allCropIds } },
          select: { id: true, name: true },
        })).map((crop) => [crop.id, crop]),
      );

  const serializeCropId = (cropId: string) => cropsById.get(cropId)?.name ?? null;

  const data = requests.map((req) => ({
    ...req,
    currentCropNames: req.currentCropIds.map(serializeCropId),
    requestedCropNames: req.requestedCropIds.map(serializeCropId),
  }));

  return apiOk({ data, total, page, limit });
}
