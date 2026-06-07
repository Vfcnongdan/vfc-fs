import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser, requireRole, apiError, apiOk } from "@/lib/request";
import { Role } from "@prisma/client";
import { ensureUserProfile } from "@/lib/userProfile";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getRequestUser(request);
  if (!user || !requireRole(user, Role.ADMIN)) return apiError("Unauthorized", 401);

  const targetUser = await prisma.user.findUnique({
    where: { id },
    include: {
      farmer: true,
      saleProfile: true,
      profile: true,
    }
  });

  if (!targetUser) return apiError("User not found", 404);
  return apiOk(targetUser);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getRequestUser(request);
  if (!user || !requireRole(user, Role.ADMIN)) return apiError("Unauthorized", 401);

  const body = await request.json();
  const { name, role, isActive, address, notes, cropIds } = body;

  const updatedUser = await prisma.user.update({
    where: { id },
    data: {
      name: name !== undefined ? name : undefined,
      role: role !== undefined ? role : undefined,
      isActive: isActive !== undefined ? isActive : undefined,
    }
  });

  const shouldUpdateProfile =
    address !== undefined || notes !== undefined || cropIds !== undefined;

  if (shouldUpdateProfile) {
    if (cropIds !== undefined && !Array.isArray(cropIds)) {
      return apiError("INVALID_CROPS", 400);
    }

    await ensureUserProfile(id);

    const validCropIds =
      cropIds !== undefined
        ? (
            await prisma.crop.findMany({
              where: { id: { in: cropIds } },
              select: { id: true },
            })
          ).map((c) => c.id)
        : null;

    await prisma.$transaction(async (tx) => {
      const existingProfile = await tx.userProfile.findUnique({
        where: { userId: id },
        select: { cropIds: true, address: true, notes: true },
      });

      const nextAddress =
        address !== undefined
          ? (typeof address === "string" && address.trim().length > 0
              ? address.trim()
              : null)
          : existingProfile?.address ?? null;

      const nextNotes =
        notes !== undefined
          ? (typeof notes === "string" && notes.trim().length > 0
              ? notes.trim()
              : null)
          : existingProfile?.notes ?? null;

      const nextCropIds = validCropIds ?? existingProfile?.cropIds ?? [];

      await tx.userProfile.upsert({
        where: { userId: id },
        create: {
          userId: id,
          cropIds: nextCropIds,
          address: nextAddress,
          notes: nextNotes,
        },
        update: {
          address: nextAddress,
          notes: nextNotes,
          ...(validCropIds ? { cropIds: nextCropIds } : {}),
        },
      });

    });
  }

  const targetUser = await prisma.user.findUnique({
    where: { id },
    include: { profile: true, farmer: true, saleProfile: true },
  });

  return apiOk(targetUser ?? updatedUser);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getRequestUser(request);
  if (!user || !requireRole(user, Role.ADMIN)) return apiError("Unauthorized", 401);

  // Check if trying to delete self
  if (user.id === id) return apiError("Cannot delete yourself", 400);

  await prisma.user.delete({
    where: { id }
  });

  return apiOk({ success: true });
}
