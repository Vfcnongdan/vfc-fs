import { CropChangeRequestStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { canReviewCropChangeRequest } from "@/lib/cropChangeRequests";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, getRequestUser } from "@/lib/request";

async function getReviewRequest(id: string) {
  return prisma.cropChangeRequest.findUnique({
    where: { id },
    include: {
      requester: { select: { id: true, name: true, phone: true, role: true } },
      reviewer: { select: { id: true, name: true, phone: true, role: true } },
    },
  });
}

async function cropMap(ids: string[]) {
  if (ids.length === 0) return new Map();
  const crops = await prisma.crop.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, cropCode: true },
  });
  return new Map(crops.map((crop) => [crop.id, crop]));
}

// GET /api/crop-change-requests/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getRequestUser(request);
  if (!user) return apiError("UNAUTHORIZED", 401);

  const { id } = await params;
  const changeRequest = await getReviewRequest(id);
  if (!changeRequest) return apiError("NOT_FOUND", 404);
  if (!(await canReviewCropChangeRequest(user, changeRequest))) {
    return apiError("FORBIDDEN", 403);
  }

  const allCropIds = Array.from(
    new Set([...changeRequest.currentCropIds, ...changeRequest.requestedCropIds]),
  );
  const cropsById = await cropMap(allCropIds);
  const serializeCrop = (cropId: string) =>
    cropsById.get(cropId) ?? { id: cropId, name: "Cây trồng không còn tồn tại", cropCode: "" };

  return apiOk({
    id: changeRequest.id,
    status: changeRequest.status,
    requester: changeRequest.requester,
    reviewer: changeRequest.reviewer,
    requesterRole: changeRequest.requesterRole,
    reviewerRole: changeRequest.reviewerRole,
    reviewerNote: changeRequest.reviewerNote,
    reviewedAt: changeRequest.reviewedAt,
    createdAt: changeRequest.createdAt,
    currentCrops: changeRequest.currentCropIds.map(serializeCrop),
    requestedCrops: changeRequest.requestedCropIds.map(serializeCrop),
  });
}

// PATCH /api/crop-change-requests/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getRequestUser(request);
  if (!user) return apiError("UNAUTHORIZED", 401);

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = body?.action;
  const note = typeof body?.note === "string" ? body.note.trim() : null;

  if (action !== "APPROVE" && action !== "REJECT") {
    return apiError("INVALID_ACTION", 400);
  }

  const changeRequest = await getReviewRequest(id);
  if (!changeRequest) return apiError("NOT_FOUND", 404);
  if (!(await canReviewCropChangeRequest(user, changeRequest))) {
    return apiError("FORBIDDEN", 403);
  }
  if (changeRequest.status !== CropChangeRequestStatus.PENDING) {
    return apiError("REQUEST_ALREADY_REVIEWED", 409);
  }

  const approved = action === "APPROVE";
  const nextStatus = approved
    ? CropChangeRequestStatus.APPROVED
    : CropChangeRequestStatus.REJECTED;

  await prisma.$transaction(async (tx) => {
    if (approved) {
      await tx.userProfile.upsert({
        where: { userId: changeRequest.requesterId },
        create: {
          userId: changeRequest.requesterId,
          cropIds: changeRequest.requestedCropIds,
          address: null,
          notes: null,
        },
        update: { cropIds: changeRequest.requestedCropIds },
      });
    }

    await tx.cropChangeRequest.update({
      where: { id },
      data: {
        status: nextStatus,
        reviewerNote: note,
        reviewedAt: new Date(),
      },
    });

    await tx.notification.create({
      data: {
        recipientId: changeRequest.requesterId,
        cropChangeRequestId: id,
        type: approved ? "CROP_CHANGE_APPROVED" : "CROP_CHANGE_REJECTED",
        title: approved
          ? "Thay đổi cây trồng đã được duyệt"
          : "Thay đổi cây trồng bị từ chối",
        message: approved
          ? "Danh sách cây trồng của bạn đã được cập nhật."
          : note || "Danh sách cây trồng hiện tại được giữ nguyên.",
      },
    });
  });

  return apiOk({ ok: true, status: nextStatus });
}
