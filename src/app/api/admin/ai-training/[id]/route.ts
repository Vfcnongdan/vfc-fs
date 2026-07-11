import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser, apiError, apiOk } from "@/lib/request";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequestUser(request);
  if (!user || user.role !== "ADMIN") {
    return apiError("UNAUTHORIZED", 401);
  }

  const id = (await params).id;
  const body = await request.json().catch(() => null);
  if (!body) return apiError("INVALID_BODY", 400);

  const {
    cropType,
    growthStage,
    pestDisease,
    detail,
    severityLevel,
    imageUrls,
    description,
    vfcSolution,
    actionThreshold,
    pestDensity,
  } = body;

  try {
    const record = await prisma.planStageDisease.update({
      where: { id },
      data: {
        ...(cropType && { cropType }),
        ...(growthStage && { growthStage }),
        ...(pestDisease && { pestDisease }),
        ...(detail && { detail }),
        ...(severityLevel && { severityLevel }),
        ...(imageUrls !== undefined && { imageUrls: Array.isArray(imageUrls) ? imageUrls : [] }),
        ...(description !== undefined && { description }),
        ...(vfcSolution !== undefined && { vfcSolution }),
        ...(actionThreshold !== undefined && { actionThreshold }),
        ...(pestDensity !== undefined && { pestDensity }),
      },
    });

    return apiOk(record);
  } catch (error) {
    console.error("UPDATE_AI_TRAINING_ERROR:", error);
    return apiError("Không thể cập nhật dữ liệu", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequestUser(request);
  if (!user || user.role !== "ADMIN") {
    return apiError("UNAUTHORIZED", 401);
  }

  const id = (await params).id;

  try {
    await prisma.planStageDisease.delete({
      where: { id },
    });

    return apiOk({ success: true });
  } catch (error) {
    console.error("DELETE_AI_TRAINING_ERROR:", error);
    return apiError("Không thể xóa dữ liệu", 500);
  }
}
