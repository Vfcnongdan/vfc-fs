import { CropChangeRequestStatus, Role, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type CropChangeUser = Pick<User, "id" | "role" | "name">;

function requiresCropChangeApproval(user: CropChangeUser) {
  // Chỉ FARMER cần duyệt bởi MDO, các role khác (AGENCY, SE, MDO...) tự do thay đổi
  return user.role === Role.FARMER;
}

function sameCropIds(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const aSet = new Set(a);
  return b.every((id) => aSet.has(id));
}

export async function findCropChangeReviewer(user: CropChangeUser) {
  // Chỉ FARMER cần reviewer (MDO)
  if (user.role === Role.FARMER) {
    const farmer = await prisma.farmer.findUnique({
      where: { userId: user.id },
      select: { mdo: true },
    });
    const mdoName = farmer?.mdo?.trim();
    if (!mdoName) return null;

    const mdo = await prisma.mdo.findFirst({
      where: { name: mdoName, userId: { not: null } },
      include: { user: true },
    });
    return mdo?.user ?? null;
  }

  return null;
}

export async function submitCropChangeRequest(user: CropChangeUser, cropIds: string[]) {
  const validCrops = await prisma.crop.findMany({
    where: { id: { in: cropIds }, isActive: true },
    select: { id: true },
  });
  const validCropIds = validCrops.map((crop) => crop.id);

  const profile = await prisma.userProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, cropIds: [], address: null, notes: null },
    update: {},
    select: { cropIds: true },
  });

  if (sameCropIds(profile.cropIds, validCropIds)) {
    return { ok: true, unchanged: true } as const;
  }

  if (!requiresCropChangeApproval(user)) {
    await prisma.userProfile.update({
      where: { userId: user.id },
      data: { cropIds: validCropIds },
    });

    return { ok: true, applied: true } as const;
  }

  const reviewer = await findCropChangeReviewer(user);
  if (!reviewer) {
    return { error: "REVIEWER_NOT_FOUND", status: 400 } as const;
  }

  const reviewerRole = reviewer.role;
  const request = await prisma.$transaction(async (tx) => {
    const existing = await tx.cropChangeRequest.findFirst({
      where: {
        requesterId: user.id,
        status: CropChangeRequestStatus.PENDING,
      },
      orderBy: { createdAt: "desc" },
    });

    const savedRequest = existing
      ? await tx.cropChangeRequest.update({
          where: { id: existing.id },
          data: {
            reviewerId: reviewer.id,
            reviewerRole,
            currentCropIds: profile.cropIds,
            requestedCropIds: validCropIds,
          },
        })
      : await tx.cropChangeRequest.create({
          data: {
            requesterId: user.id,
            reviewerId: reviewer.id,
            requesterRole: user.role,
            reviewerRole,
            currentCropIds: profile.cropIds,
            requestedCropIds: validCropIds,
          },
        });

    await tx.notification.createMany({
      data: [
        {
          recipientId: reviewer.id,
          cropChangeRequestId: savedRequest.id,
          type: "CROP_CHANGE_REQUESTED",
          title: "Yêu cầu duyệt cây trồng",
          message: `${user.name ?? "Người dùng"} vừa gửi thay đổi cây trồng chờ duyệt.`,
        },
        {
          recipientId: user.id,
          cropChangeRequestId: savedRequest.id,
          type: "CROP_CHANGE_PENDING",
          title: "Thay đổi cây trồng đang chờ duyệt",
          message: "Danh sách cây trồng hiện tại vẫn được giữ nguyên trong lúc chờ duyệt.",
        },
      ],
    });

    return savedRequest;
  });

  return { ok: true, request } as const;
}

export type CropChangeRequestResult = Awaited<ReturnType<typeof submitCropChangeRequest>>;
type PendingCropChangeRequestResult = Extract<CropChangeRequestResult, { request: unknown }>;

export function hasPendingCropChangeRequest(
  result: CropChangeRequestResult,
): result is PendingCropChangeRequestResult {
  return "request" in result;
}

export async function canReviewCropChangeRequest(
  user: Pick<User, "id" | "role">,
  request: { reviewerId: string },
) {
  return user.role === Role.ADMIN || request.reviewerId === user.id;
}
